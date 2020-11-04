import { getLogger } from '../logging/Logger';

const logger = getLogger({ con: { level: 'debug' } });

export interface ISlice<T> {
    start: number;
    end: number;
    position: number;
    chunk: T;
}

export abstract class ISlicer<T> {
    private position: number = 0;
    public readonly totalChunks: number;

    constructor(protected readonly totalSize: number, protected readonly chunkSize: number) {
        this.totalChunks = Math.ceil(this.totalSize / chunkSize);
    }

    public seek(position: number) {
        if (position < 0 || position > this.totalChunks)
            throw new Error(`Position ${position} is out of boundaries: 0 and ${this.position}`);
        this.position = position;
    }

    protected abstract nextValue(start: number): T;

    public *chunks(): IterableIterator<ISlice<T>> {
        while (this.totalChunks > this.position) {
            const start = this.position * this.chunkSize;
            const end = this.totalChunks === this.position + 1 ? this.totalSize : (this.position + 1) * this.chunkSize;
            logger.debug(`FileSlicer.next ${start}-${end}, position=${this.position}`);
            this.position++;

            const chunk = this.nextValue(start);
            yield { chunk, start, end, position: this.position - 1 };
        }
    }
}
