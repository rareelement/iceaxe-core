import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import { GlacierManager } from '../../src/manager/GlacierManager';
import { GetJobOutputOutput } from 'aws-sdk/clients/glacier';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { Readable } from 'stream';
import { resolve, join } from 'path';
import { TEST_FILENAME } from '../helpers';

const root = resolve(__dirname);
const outputFile = join(root, TEST_FILENAME + '.temp');

beforeEach(async (done) => {
    AWSMock.setSDKInstance(AWS);
    try {
        if (existsSync(outputFile)) {
            unlinkSync(outputFile);
        }
    } catch (err) {
        console.error(err);
    }
    done();
});

afterEach(async (done) => {
    AWSMock.restore('Glacier');
    done();
})

describe('GlacierManager download tests', () => {

    test('Success test with zero vaults', async () => {
        const text = `So the secret to good self-esteem is to lower your expectations to the point where they're already met?`;

        AWSMock.mock('Glacier', 'getJobOutput', (params: void, callback: Function) => {
            const response: GetJobOutputOutput = {
                body: Readable.from(text)

            };
            callback(null, response);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const result = await manager.downloadArchive({
            vaultName: 'test-vault',
            destinationFile: outputFile,
            jobId: 'wwwwwwwwwwwwwww'
        });
        const downloadedContent = readFileSync(outputFile);
        expect(new String(downloadedContent).toString()).toEqual(text);
    });

});