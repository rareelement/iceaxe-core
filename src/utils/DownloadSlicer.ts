import { getLogger } from '../logging/Logger';
import { ISlicer } from './Slicer';

const logger = getLogger({ con: { level: 'debug' } });

export class DownloadSlicer extends ISlicer<void> {

    public static create({ totalSize, chunkSize }: { totalSize: number; chunkSize: number; }) {
        return new DownloadSlicer(totalSize, chunkSize);
    }

    private constructor(
        public readonly totalSize: number,
        public readonly chunkSize: number) {
        super(totalSize, chunkSize);
    }

    protected nextValue(start: number): void {
    }
}
