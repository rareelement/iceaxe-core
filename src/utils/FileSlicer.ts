import { existsSync, statSync } from 'fs';
import { sync } from 'read-chunk';
import { getLogger } from '../logging/Logger';
import { ISlicer } from './Slicer';

const logger = getLogger({ con: { level: 'debug' } });

export class FileSlicer extends ISlicer<Buffer> {

    public static create({ path, chunkSize }: { path: string; chunkSize: number; }) {
        if (!existsSync(path)) {
            throw new Error(`File ${path} not found`);
        }

        const totalSize = statSync(path).size;
        return new FileSlicer(path, totalSize, chunkSize);
    }

    private constructor(
        readonly path: string,
        public readonly totalSize: number,
        public readonly chunkSize: number) {
        super(totalSize, chunkSize
        );
    }

    protected nextValue(start: number): Buffer {
        return sync(this.path, start, this.chunkSize);
    }
}
