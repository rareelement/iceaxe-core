import { statSync } from 'fs';
import { resolve, join } from 'path';
import { FileSlicer, TFileSlicerChunk } from '../../src/utils/FileSlicer';
import { TEST_FILENAME } from '../helpers';

const root = resolve(__dirname);
const file = join(root, TEST_FILENAME);

const fileSize = statSync(file).size;

describe('File slicer tests', () => {
    test('Test size and total chunks calculations', async () => {
        let chunkSize = 2;
        let slicer = new FileSlicer(file, chunkSize);
        expect(slicer.totalSize).toBe(fileSize);
        expect(slicer.totalChunks).toBe(Math.ceil(fileSize / chunkSize));

        chunkSize = 3;
        slicer = new FileSlicer(file, chunkSize);
        expect(slicer.totalSize).toBe(fileSize);
        expect(slicer.totalChunks).toBe(Math.ceil(fileSize / chunkSize));

        chunkSize = fileSize;
        slicer = new FileSlicer(file, chunkSize);
        expect(slicer.totalSize).toBe(fileSize);
        expect(slicer.totalChunks).toBe(1);

        chunkSize = fileSize + 2;
        slicer = new FileSlicer(file, chunkSize);
        expect(slicer.totalSize).toBe(fileSize);
        expect(slicer.totalChunks).toBe(1);
    });

    test('Test reading file in multiple chunks', async () => {
        const chunkSize = 8;
        const slicer = new FileSlicer(file, chunkSize);

        let prev: TFileSlicerChunk | undefined = undefined;
        let currChunk = 0;

        let buff: Buffer | undefined = undefined;

        for (const chunk of slicer.chunks()) {

            const [data, params] = chunk;
            const { start, end, position } = params;

            buff = !buff ? data : Buffer.concat([buff, data]);
            expect(position).toBe(currChunk);

            if (currChunk !== slicer.totalChunks - 1)
                expect(end - start).toBe(chunkSize);
            else
                expect(end - start).toBe(fileSize - chunkSize * position);

            if (prev) {
                expect(start).toBe(prev[1].end);
            }
            prev = chunk;
            currChunk++;
        }

        expect(new String(buff).toString()).toEqual('v3rv2rv34v4rtvb435rv43rbbv45bv45\nver\nverv2\nrv\n2\n4\n');
    });

    test('Test seek 0 in file', async () => {
        const chunkSize = 8;
        const slicer = new FileSlicer(file, chunkSize);
        slicer.seek(0)

        let prev: TFileSlicerChunk | undefined = undefined;
        let currChunk = 0;

        let buff: Buffer | undefined = undefined;

        for (const chunk of slicer.chunks()) {

            const [data, params] = chunk;
            const { start, end, position } = params;

            buff = !buff ? data : Buffer.concat([buff, data]);
            expect(position).toBe(currChunk);

            if (currChunk === slicer.totalChunks)
                expect(end - start).toBe(chunkSize);

            if (prev) {
                expect(start).toBe(prev[1].end);
            }
            prev = chunk;
            currChunk++;
        }

        expect(new String(buff).toString()).toEqual('v3rv2rv34v4rtvb435rv43rbbv45bv45\nver\nverv2\nrv\n2\n4\n');
    });

    test('Test seek 2 in file', async () => {
        const chunkSize = 8;
        const slicer = new FileSlicer(file, chunkSize);
        slicer.seek(2)

        let prev: TFileSlicerChunk | undefined = undefined;
        let currChunk = 2;

        let buff: Buffer | undefined = undefined;

        for (const chunk of slicer.chunks()) {

            const [data, params] = chunk;
            const { start, end, position } = params;

            buff = !buff ? data : Buffer.concat([buff, data]);
            expect(position).toBe(currChunk);

            if (currChunk === slicer.totalChunks)
                expect(end - start).toBe(chunkSize);

            if (prev) {
                expect(start).toBe(prev[1].end);
            }
            prev = chunk;
            currChunk++;
        }

        expect(new String(buff).toString()).toEqual('35rv43rbbv45bv45\nver\nverv2\nrv\n2\n4\n');
    });

    test('Test seek end in file', async () => {
        const chunkSize = 8;
        const slicer = new FileSlicer(file, chunkSize);
        slicer.seek(Math.ceil(fileSize / chunkSize));

        for (const chunk of slicer.chunks()) {
            fail('reached end of the file already');
        }

    });
});
