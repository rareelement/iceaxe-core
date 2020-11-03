import { statSync } from 'fs';
import { resolve, join } from 'path';
import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';

import { UploadMultipartPartInput, CompleteMultipartUploadInput } from 'aws-sdk/clients/glacier';
import { FileUploader } from '../../src/utils/FileUploader';
import { TEST_FILENAME, sleep } from '../helpers';
import { IOProcessController } from '../../src/manager/model';

const root = resolve(__dirname);
const file = join(root, TEST_FILENAME);

const fileSize = statSync(file).size;


beforeEach(async (done) => {
    AWSMock.setSDKInstance(AWS);
    done();
});

afterEach(async (done) => {
    AWSMock.restore('Glacier');
    done();
})

describe('GlacierManager file upload tests', () => {

    test('Success full upload', async () => {
        // mock AWS API calls
        let callCounter: number = 0;
        AWSMock.mock('Glacier', 'uploadMultipartPart', (params: UploadMultipartPartInput, callback: Function) => {
            callCounter++;
            callback(null, null);
        });

        let completeCounter: number = 0;
        AWSMock.mock('Glacier', 'completeMultipartUpload', (params: CompleteMultipartUploadInput, callback: Function) => {
            expect(params.checksum).toEqual('04b1765f61ad1d8920dc71889e9bce10aa160ac52b4ca5e9bcae12103cdd51a8');
            callback(null, null);
            completeCounter++;
        });

        const destination = {
            accountId: '-',
            vaultName: 'test',
            uploadId: 'mqiowenciqwniencwiqeniqwne',
            chunkSize: 4
        };

        const uploader = new FileUploader(file, destination, new AWS.Glacier());
        const controller: IOProcessController = await uploader.upload();

        while (!(await controller.status()).completed) {
            await sleep(200);
            console.log(await controller.status());
        }

        expect(callCounter).toEqual(Math.ceil(fileSize / destination.chunkSize));
        expect(completeCounter).toEqual(1);
    });

    test('Success aborted upload', async () => {
        // mock AWS API calls
        let callCounter: number = 0;
        AWSMock.mock('Glacier', 'uploadMultipartPart', async (params: UploadMultipartPartInput, callback: Function) => {
            callCounter++;
            await sleep(500);
            callback(null, null);
        });

        let completeCounter: number = 0;
        AWSMock.mock('Glacier', 'completeMultipartUpload', (params: CompleteMultipartUploadInput, callback: Function) => {
            expect(params.checksum).toEqual('04b1765f61ad1d8920dc71889e9bce10aa160ac52b4ca5e9bcae12103cdd51a8');
            callback(null, null);
            completeCounter++;
        });

        const destination = {
            accountId: '-',
            vaultName: 'test',
            uploadId: 'mqiowenciqwniencwiqeniqwne',
            chunkSize: 4
        };

        const uploader = new FileUploader(file, destination, new AWS.Glacier());
        const controller: IOProcessController = await uploader.upload();

        let count = 0;
        while (!(await controller.status()).completed) {
            count++;
            console.log(await controller.status());
            if (count > 3) {
                await controller.abort();
                console.log('Aborting');
                break;
            }
            await sleep(1000);
        }

        expect(callCounter).toBeLessThan(Math.ceil(fileSize / destination.chunkSize));
        expect(completeCounter).toEqual(0);
    });
});
