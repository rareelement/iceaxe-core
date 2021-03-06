import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import { GlacierManager } from '../../src/manager/GlacierManager';
import { GetJobOutputOutput, ListJobsOutput, InitiateJobOutput } from 'aws-sdk/clients/glacier';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { TEST_FILENAME, vaultOutput } from '../helpers';

const root = resolve(__dirname);
const outputFile = join(root, TEST_FILENAME + '.temp');
const filename = 'Telegraph_Road.pdf';

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

describe('GlacierManager getRetrievalJobs tests', () => {

    test('Success test with zero retrival jobs', async () => {
        const vaultName = 'test-vault';
        const vault = vaultOutput(vaultName, undefined);

        let listCallCounter: number = 0
        AWSMock.mock('Glacier', 'listJobs', (params: void, callback: Function) => {
            const response: ListJobsOutput = {
                JobList: [{
                    Action: 'ArchiveRetrieval',
                    VaultARN: vault.VaultARN!,
                    JobDescription: filename,
                    Completed: true
                }]
            };
            listCallCounter++;
            callback(null, response);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const result = await manager.getRetrievalJobs({
            vaultName: 'test-vault',
            archiveId: 'something',
            returnCompletedOnly: true
        });

        expect(listCallCounter).toBe(1);

    });

});

describe('GlacierManager getOrInitiateRetrievalJob tests', () => {

    test('Success test with no matching inventory jobs, dont create new one', async () => {
        const vaultName = 'test-vault';
        const vault = vaultOutput(vaultName, undefined);
        const archiveId = 'aaaaaaaaaaaaa';

        let listCallCounter: number = 0
        AWSMock.mock('Glacier', 'listJobs', (params: void, callback: Function) => {
            const response: ListJobsOutput = {
                JobList: [{
                    Action: 'ArchiveRetrieval',
                    VaultARN: vault.VaultARN!,
                    JobDescription: filename,
                    ArchiveId: archiveId,
                    Completed: true
                }]
            };
            listCallCounter++;
            callback(null, response);
        });

        let initiateJobCounter: number = 0
        AWSMock.mock('Glacier', 'initiateJob', (params: void, callback: Function) => {
            const response: InitiateJobOutput = {
                jobId: 'fqwefqwefqwdfw'
            };
            initiateJobCounter++;
            callback(null, response);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const result = await manager.getOrInitiateRetrievalJobs({
            vaultName: 'test-vault',
            archiveId,
            useExistingJobFirst: true,
            filename,
            returnCompletedOnly: true
        });

        expect(listCallCounter).toBe(1);
        expect(initiateJobCounter).toBe(0);
    });

    test('Success test with no matching inventory jobs, create new one', async () => {
        const vaultName = 'test-vault';
        const vault = vaultOutput(vaultName, undefined);

        let listCallCounter: number = 0
        AWSMock.mock('Glacier', 'listJobs', (params: void, callback: Function) => {
            const response: ListJobsOutput = {
                JobList: [{
                    Action: 'ArchiveRetrieval',
                    VaultARN: vault.VaultARN!,
                    JobDescription: filename,
                    Completed: true
                }]
            };
            listCallCounter++;
            callback(null, response);
        });

        let initiateJobCounter: number = 0
        AWSMock.mock('Glacier', 'initiateJob', (params: void, callback: Function) => {
            const response: InitiateJobOutput = {
                jobId: 'fqwefqwefqwdfw'
            };
            initiateJobCounter++;
            callback(null, response);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const result = await manager.getOrInitiateRetrievalJobs({
            vaultName: 'test-vault',
            archiveId: 'aaaaaaaaaaaaa',
            useExistingJobFirst: false,
            filename,
            returnCompletedOnly: true
        });

        expect(listCallCounter).toBe(0);
        expect(initiateJobCounter).toBe(1);
    });

});