import { statSync } from 'fs';
import { resolve, join } from 'path';
import { FileSlicer } from '../../src/utils/FileSlicer';
import { TEST_FILENAME } from '../helpers';
import { ISlice } from '../../src/utils/Slicer';

const root = resolve(__dirname);
const file = join(root, TEST_FILENAME);

const fileSize = statSync(file).size;

describe('File slicer tests', () => {
    test('Test size and total chunks calculations', async () => {
        let chunkSize = 2;
        let slicer = FileSlicer.create({ path: file, chunkSize });
        expect(slicer.totalSize).toBe(fileSize);
        expect(slicer.totalChunks).toBe(Math.ceil(fileSize / chunkSize));

        chunkSize = 3;
        slicer = FileSlicer.create({ path: file, chunkSize });;
        expect(slicer.totalSize).toBe(fileSize);
        expect(slicer.totalChunks).toBe(Math.ceil(fileSize / chunkSize));

        chunkSize = fileSize;
        slicer = FileSlicer.create({ path: file, chunkSize });;
        expect(slicer.totalSize).toBe(fileSize);
        expect(slicer.totalChunks).toBe(1);

        chunkSize = fileSize + 2;
        slicer = FileSlicer.create({ path: file, chunkSize });;
        expect(slicer.totalSize).toBe(fileSize);
        expect(slicer.totalChunks).toBe(1);
    });

    test('Test reading file in multiple chunks', async () => {
        const chunkSize = 8;
        const slicer = FileSlicer.create({ path: file, chunkSize });;

        let prev: ISlice<Buffer> | undefined = undefined;
        let currChunk = 0;

        let buff: Buffer | undefined = undefined;

        for (const slice of slicer.chunks()) {

            const { chunk, start, end, position } = slice;
            buff = !buff ? chunk : Buffer.concat([buff, chunk]);
            expect(position).toBe(currChunk);

            if (currChunk !== slicer.totalChunks - 1)
                expect(end - start).toBe(chunkSize);
            else
                expect(end - start).toBe(fileSize - chunkSize * position);

            if (prev) {
                expect(start).toBe(prev.end);
            }
            prev = slice;
            currChunk++;
        }

        expect(new String(buff).toString()).toEqual('v3rv2rv34v4rtvb435rv43rbbv45bv45\nver\nverv2\nrv\n2\n4\n');
    });

    test('Test seek 0 in file', async () => {
        const chunkSize = 8;
        const slicer = FileSlicer.create({ path: file, chunkSize });;
        slicer.seek(0)

        let prev: ISlice<Buffer> | undefined = undefined;
        let currChunk = 0;

        let buff: Buffer | undefined = undefined;

        for (const slice of slicer.chunks()) {

            const { chunk, start, end, position } = slice;

            buff = !buff ? chunk : Buffer.concat([buff, chunk]);
            expect(position).toBe(currChunk);

            if (currChunk === slicer.totalChunks)
                expect(end - start).toBe(chunkSize);

            if (prev) {
                expect(start).toBe(prev.end);
            }
            prev = slice;
            currChunk++;
        }

        expect(new String(buff).toString()).toEqual('v3rv2rv34v4rtvb435rv43rbbv45bv45\nver\nverv2\nrv\n2\n4\n');
    });

    test('Test seek 2 in file', async () => {
        const chunkSize = 8;
        const slicer = FileSlicer.create({ path: file, chunkSize });;
        slicer.seek(2)

        let prev: ISlice<Buffer> | undefined = undefined;
        let currChunk = 2;

        let buff: Buffer | undefined = undefined;

        for (const slice of slicer.chunks()) {

            const { chunk, start, end, position } = slice;
            buff = !buff ? chunk : Buffer.concat([buff, chunk]);
            expect(position).toBe(currChunk);

            if (currChunk === slicer.totalChunks)
                expect(end - start).toBe(chunkSize);

            if (prev) {
                expect(start).toBe(prev.end);
            }
            prev = slice;
            currChunk++;
        }

        expect(new String(buff).toString()).toEqual('35rv43rbbv45bv45\nver\nverv2\nrv\n2\n4\n');
    });

    test('Test seek end in file', async () => {
        const chunkSize = 8;
        const slicer = FileSlicer.create({ path: file, chunkSize });;
        slicer.seek(Math.ceil(fileSize / chunkSize));

        for (const chunk of slicer.chunks()) {
            fail('reached end of the file already');
        }

    });
});
