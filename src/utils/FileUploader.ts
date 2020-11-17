import { FileSlicer } from './FileSlicer';
import { Glacier } from 'aws-sdk';
import { getLogger } from '../logging/Logger';
import { IceAxeError, IceAxeErrorCode } from '../manager/errors';
import { IOProcessController } from '../manager/model';
import { EventEmitter } from 'events';
import { ProcessController, IOEvent } from './ProcessController';

const logger = getLogger({ con: { level: 'debug' } });

const reduceChecksumTree = (bottom: string[], glacier: Glacier): string[] => {
    const uneven = bottom.length % 2;
    const result: string[] = [];
    const paired = Math.floor(bottom.length / 2);

    for (let i = 0; i < paired; i++) {
        const tmpHash = Buffer.from(bottom[2 * i] + bottom[2 * i + 1], 'hex');
        result.push(
            glacier.computeChecksums(tmpHash).treeHash
        );
    }

    if (uneven) {
        result.push(bottom[bottom.length - 1]);
    }

    return result.length > 1 ? reduceChecksumTree(result, glacier) : result;
};

export class FileUploader { // disposable

    private readonly eventEmitter = new EventEmitter();

    private startPosition: number = 0;
    private aborted: boolean = false;

    constructor(
        private readonly filepath: string,
        private readonly destination: {
            accountId: string;
            vaultName: string;
            uploadId: string;
            chunkSize: number;
        },
        private glacier: Glacier) {
    }

    public seek(position: number) {
        this.startPosition = position;
    }

    public async upload(): Promise<IOProcessController> {
        const controller = new ProcessController(this.eventEmitter,
            { currentOffset: this.startPosition, completed: false, aborted: false });
        this.startUpload();
        return controller;
    }

    private async startUpload() {
        try {
            const { accountId, vaultName, uploadId } = this.destination;
            const slicer = FileSlicer.create({ path: this.filepath, chunkSize: this.destination.chunkSize });

            const hashes: string[] = [];
            const maxPosition = slicer.totalSize;

            for (const slice of slicer.chunks()) {

                const { chunk, start, end, position } = slice;

                if (this.aborted) {
                    logger.warn(`File upload has been aborted uploadId=${uploadId}`);
                    this.eventEmitter.emit(IOEvent.Status, { currentOffset: position, maxPosition, aborted: true });
                    return;
                }

                logger.info(`FileUpload.upload ${JSON.stringify({ start, end, position })} bytes: ${chunk.length}`);

                const hash = this.glacier.computeChecksums(chunk);
                hashes.push(hash.linearHash);

                if (position >= this.startPosition) {
                    await this.glacier.uploadMultipartPart({
                        range: 'bytes ' + start + '-' + (end - 1) + '/*',
                        body: chunk,
                        accountId,
                        vaultName,
                        uploadId
                    }).promise();
                }
                this.eventEmitter.emit(IOEvent.Status, { currentOffset: position, maxPosition });
            }

            const finalHash = reduceChecksumTree(hashes, this.glacier);
            logger.info(`FileUpload.upload/finish ${finalHash[0]}`);

            const completed = await this.glacier.completeMultipartUpload({
                accountId,
                vaultName,
                uploadId,
                checksum: finalHash[0],
                archiveSize: slicer.totalSize.toString()
            }).promise();
            logger.info(`FileUpload.completed ${slicer.totalSize}`);

            this.eventEmitter.emit(IOEvent.Status, { currentOffset: maxPosition, maxPosition, completed: true });

        } catch (err) {
            logger.error('FileUpload.upload', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to upload file', err);
        }
    }
}
