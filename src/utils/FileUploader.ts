import { FileSlicer } from './FileSlicer';
import { Glacier } from 'aws-sdk';
import { getLogger } from '../logging/Logger';
import { IceAxeError, IceAxeErrorCode } from '../manager/errors';

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

export class FileUploader {

    private startPosition: number = 0;

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

    public async upload() {
        try {
            const { accountId, vaultName, uploadId } = this.destination;
            const slicer = new FileSlicer(this.filepath, this.destination.chunkSize);

            const hashes: string[] = [];

            for (const chunk of slicer.chunks()) {
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

        } catch (err) {
            logger.error('FileUpload.upload', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to upload file', err);
        }
    }
}
