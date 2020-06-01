import { statSync } from 'fs';
import { resolve, join } from 'path';
import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';

import { ListVaultsOutput, UploadMultipartPartInput, CompleteMultipartUploadInput } from 'aws-sdk/clients/glacier';
import { FileUploader } from '../../src/utils/FileUploader';
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

describe('GlacierManager listVaults tests', () => {

    test('Success test with zero vaults', async () => {
        // mock AWS API call
        const result: ListVaultsOutput = {
            VaultList: []
        };

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
        await uploader.upload();

        expect(callCounter).toEqual(Math.ceil(fileSize / destination.chunkSize));
        expect(completeCounter).toEqual(1);
    });
});
