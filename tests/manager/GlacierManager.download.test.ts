import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import { GlacierManager } from '../../src/manager/GlacierManager';
import { GetJobOutputOutput } from 'aws-sdk/clients/glacier';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { Readable } from 'stream';
import { resolve, join } from 'path';
import { TEST_FILENAME, sleep } from '../helpers';

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

    test('Success test', async () => {
        const text = `So the secret to good self-esteem is to lower your expectations to the point where they're already met?`;

        AWSMock.mock('Glacier', 'getJobOutput', (params: void, callback: Function) => {
            console.log('download params', JSON.stringify(params));
            const response: GetJobOutputOutput = {
                body: Readable.from(text)

            };
            callback(null, response);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const controller = await manager.downloadArchive({
            vaultName: 'test-vault',
            destinationFile: outputFile,
            jobId: 'wwwwwwwwwwwwwww',
            archiveSize: Buffer.from(text, 'utf8').length
        });

        let offset: number = 0;
        let maxPosition: number | undefined = 0;
        controller.addStatusListener(
            async (status) => {
                offset = status.currentOffset;
                maxPosition = status.maxPosition;
            }
        );

        while (!(await controller.status()).completed) {
            expect(maxPosition).toBeLessThanOrEqual(102);
            await sleep(10);
        }

        const downloadedContent = readFileSync(outputFile);
        expect(new String(downloadedContent).toString()).toEqual(text);
        expect(offset).toEqual(103);
        expect(maxPosition).toEqual(103);
    });

});