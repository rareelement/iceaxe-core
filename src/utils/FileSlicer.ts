import { existsSync, statSync } from 'fs';
import { sync } from 'read-chunk';
import { getLogger } from '../logging/Logger';

const logger = getLogger({ con: { level: 'debug' } });

export type TFileSlicerChunk = [Buffer, { start: number; end: number; position: number; }];

export class FileSlicer {
    private position: number = 0;
    public readonly totalSize: number;
    public readonly totalChunks: number;

    constructor(private readonly path: string, private readonly chunkSize: number) {
        if (!existsSync(path)) {
            throw new Error(`File ${path} not found`);
        }
        this.totalSize = statSync(path).size;
        this.totalChunks = Math.ceil(this.totalSize / chunkSize);
    }

    public seek(position: number) {
        if (position < 0 || position > this.totalChunks)
            throw new Error(`Position ${position} is out of boundaries: 0 and ${this.position}`);
        this.position = position;
    }

    public *chunks(): IterableIterator<TFileSlicerChunk> {
        while (this.totalChunks > this.position) {
            const start = this.position * this.chunkSize;
            const end = this.totalChunks === this.position + 1 ? this.totalSize : (this.position + 1) * this.chunkSize;
            logger.debug(`FileSlicer.next ${start}-${end}, position=${this.position}`);
            this.position++;

            const chunk = sync(this.path, start, this.chunkSize);

            yield [chunk, { start, end, position: this.position - 1 }];
        }
    }
}
