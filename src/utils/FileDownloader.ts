import { Glacier } from 'aws-sdk';
import { EventEmitter } from 'events';
import { createWriteStream, WriteStream } from 'fs';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import { getLogger } from '../logging/Logger';
import { IceAxeError, IceAxeErrorCode } from '../manager/errors';
import { IOProcessController } from '../manager/model';
import { ProcessController, IOEvent } from './ProcessController';
import { DownloadSlicer } from './DownloadSlicer';

const logger = getLogger({ con: { level: 'debug' } });

export class FileDownloader { // disposable

    private readonly eventEmitter = new EventEmitter();

    private startPosition: number = 0;
    private aborted: boolean = false;

    constructor(
        private readonly params: {
            destinationFile: string;
            chunkSize: number;
            accountId: string;
            jobId: string;
            archiveSize?: number;
            vaultName: string;
        },
        private glacier: Glacier) {
    }

    public seek(position: number) {
        this.startPosition = position;
    }

    public async download(): Promise<IOProcessController> {
        const controller = new ProcessController(this.eventEmitter,
            { currentOffset: this.startPosition, completed: false, aborted: false });
        this.startDownload();
        return controller;
    }

    private async startDownload() {

        const { destinationFile, jobId, vaultName, archiveSize, accountId, chunkSize } = this.params;

        let writableStream: WriteStream | undefined;
        const slicer = DownloadSlicer.create({ totalSize: archiveSize!, chunkSize });
        try {

            const pipelinePromise = promisify(pipeline);

            writableStream = createWriteStream(destinationFile, { autoClose: false });

            for (const slice of slicer.chunks()) {
                const { start, end, position } = slice;

                if (this.aborted) {
                    logger.warn(`File download has been aborted jobId=${jobId}`);
                    this.eventEmitter.emit(IOEvent.Status, { currentOffset: position, aborted: true });
                    return;
                }

                logger.info(`FileDownload.download ${JSON.stringify({ start, end, position })}`);

                const retrivalJobOutput = await this.glacier.getJobOutput({
                    accountId,
                    vaultName,
                    jobId,
                    range: 'bytes ' + start + '-' + (end - 1) + '/*'
                }).promise();

                const { body, acceptRanges } = retrivalJobOutput;

                if (body && (body as Readable).readable) {
                    await pipelinePromise(
                        (body as Readable),
                        writableStream
                    );
                } else {
                    writableStream.write(body as Readable);
                }
                this.eventEmitter.emit(IOEvent.Status, { currentOffset: position });
            }

            this.eventEmitter.emit(IOEvent.Status, { currentOffset: slicer.totalSize, completed: true });

        } catch (err) {
            logger.error('FileDownloader.downloadArchive', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to download archive', err);
        } finally {
            writableStream?.close();
        }
    }
}
