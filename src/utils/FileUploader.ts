import { FileSlicer } from './FileSlicer';
import { Glacier } from 'aws-sdk';
import { getLogger } from '../logging/Logger';
import { IceAxeError, IceAxeErrorCode } from '../manager/errors';
import { IOProcessController, IOProcessStatus } from '../manager/model';
import { EventEmitter } from 'events';

const logger = getLogger({ con: { level: 'debug' } });

enum UploadEvent {
    Status = 'status',
    Abort = 'abort'
}

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

export class ProcessController implements IOProcessController {

    private _status: IOProcessStatus;

    constructor(private readonly eventEmitter: EventEmitter, initialStatus: IOProcessStatus) {
        this._status = initialStatus;
        this.eventEmitter.addListener(UploadEvent.Status, (newStatus: IOProcessStatus) => this._status = newStatus);
    }

    public async abort() {
        this.eventEmitter.emit(UploadEvent.Abort);
    }

    public async status(): Promise<IOProcessStatus> {
        return this._status;
    }

    public async addStatusListener(handler: (status: IOProcessStatus) => Promise<void>) {
        this.eventEmitter.addListener(UploadEvent.Status, handler);
    }
}

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
        const controller = new ProcessController(this.eventEmitter, { currentOffset: this.startPosition, completed: false });
        this.startUpload();
        return controller;
    }

    private async startUpload() {
        try {
            const { accountId, vaultName, uploadId } = this.destination;
            const slicer = new FileSlicer(this.filepath, this.destination.chunkSize);

            const hashes: string[] = [];

            for (const chunk of slicer.chunks()) {
                if (this.aborted) {
                    logger.warn(`File upload has been aborted uploadId=${uploadId}`);
                }

                const [data, params] = chunk;
                const { start, end, position } = params;
                logger.info(`FileUpload.upload ${JSON.stringify(params)} bytes: ${data.length}`);

                const hash = this.glacier.computeChecksums(data);
                hashes.push(hash.linearHash);

                if (position >= this.startPosition) {
                    await this.glacier.uploadMultipartPart({
                        range: 'bytes ' + start + '-' + (end - 1) + '/*',
                        body: data,
                        accountId,
                        vaultName,
                        uploadId
                    }).promise();
                }
                this.eventEmitter.emit(UploadEvent.Status, { currentOffset: position });
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

            this.eventEmitter.emit(UploadEvent.Status, { currentOffset: slicer.totalSize, completed: true });

        } catch (err) {
            logger.error('FileUpload.upload', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to upload file', err);
        }
    }
}
