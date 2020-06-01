import { statSync } from 'fs';
import { resolve, join } from 'path';
import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import { GlacierManager } from '../../src/manager/GlacierManager';
import { UploadMultipartPartInput, CompleteMultipartUploadInput, ListMultipartUploadsInput, InitiateMultipartUploadInput } from 'aws-sdk/clients/glacier';
import { TEST_FILENAME } from '../helpers';

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

describe('GlacierManager uploadFile tests', () => {

    test('Success file upload, no existing upload', async () => {
        const params = {
            path: join(root, '../resources/'),
            filename: TEST_FILENAME.split('/').pop()!,
            vaultName: 'test'
        };


        AWSMock.mock('Glacier', 'listMultipartUploads', (params: ListMultipartUploadsInput, callback: Function) => {

            callback(null, [{
                ArchiveDescription: '',
                CreationDate: '',
                VaultARN: '',
                MultipartUploadId: 'r12r124r12r',
                PartSizeInBytes: 4
            }]);
        });

        AWSMock.mock('Glacier', 'initiateMultipartUpload', (params: InitiateMultipartUploadInput, callback: Function) => {

            callback(null, { location: 'qerfqerfqe', uploadId: 'qweeeeewqfwe' });
        });

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

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true, chunkSize: 4 }, new AWS.Glacier());
        await manager.uploadFile(params);
        // expect(vaults).toStrictEqual([]);
    });

    test('Success file upload, there is an active upload', async () => {
        const params = {
            path: join(root, '../resources/'),
            filename: TEST_FILENAME.split('/').pop()!,
            vaultName: 'test'
        };

        AWSMock.mock('Glacier', 'listMultipartUploads', (params: ListMultipartUploadsInput, callback: Function) => {

            callback(null, {
                UploadsList: [{
                    ArchiveDescription: `{"filename":"${TEST_FILENAME.split('/').pop()}", "version": 1}`,
                    CreationDate: '',
                    VaultARN: '',
                    MultipartUploadId: 'r12r124r12r',
                    PartSizeInBytes: 4
                }]
            });
        });

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

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true, chunkSize: 4 }, new AWS.Glacier());
        await manager.uploadFile(params);

        expect(callCounter).toEqual(Math.ceil(fileSize / 4));
        expect(completeCounter).toEqual(1);
    });

    test('Success file upload, defaault chunk size', async () => {
        const params = {
            path: join(root, '../resources/'),
            filename: TEST_FILENAME.split('/').pop()!,
            vaultName: 'test'
        };

        AWSMock.mock('Glacier', 'listMultipartUploads', (params: ListMultipartUploadsInput, callback: Function) => {

            callback(null, {
                UploadsList: [{
                    ArchiveDescription: `{"filename":"${TEST_FILENAME.split('/').pop()}", "version": 1}`,
                    CreationDate: '',
                    VaultARN: '',
                    MultipartUploadId: 'r12r124r12r',
                    PartSizeInBytes: undefined
                }]
            });
        });

        let callCounter: number = 0;
        AWSMock.mock('Glacier', 'uploadMultipartPart', (params: UploadMultipartPartInput, callback: Function) => {
            callCounter++;
            callback(null, null);
        });

        let completeCounter: number = 0;
        AWSMock.mock('Glacier', 'completeMultipartUpload', (params: CompleteMultipartUploadInput, callback: Function) => {
            expect(params.checksum).toEqual('a466127523122675d3539b3ab562671da737e3b76a2fd55e21cfc6e7a19263be');
            callback(null, null);
            completeCounter++;
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        await manager.uploadFile(params);

        expect(callCounter).toEqual(1);
        expect(completeCounter).toEqual(1);
    });

});
