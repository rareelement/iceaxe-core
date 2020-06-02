import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import { GlacierManager } from '../../src/manager/GlacierManager';
import { GetJobOutputOutput, ListJobsOutput, InitiateJobOutput } from 'aws-sdk/clients/glacier';
import { existsSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { TEST_FILENAME, vaultOutput } from '../helpers';
import { TAWSInventoryReport } from '../../src/manager/model';

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

describe('GlacierManager loadInventory tests', () => {

    test('Success no existing job', async () => {

        let listCallCounter: number = 0;
        AWSMock.mock('Glacier', 'listJobs', (params: void, callback: Function) => {
            const response: ListJobsOutput = {
                JobList: []
            };
            listCallCounter++;
            callback(null, response);
        });

        let initiateJobCounter: number = 0;
        AWSMock.mock('Glacier', 'initiateJob', (params: void, callback: Function) => {
            const response: InitiateJobOutput = {
                jobId: 'unused'
            };
            initiateJobCounter++;
            callback(null, response);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const result = await manager.loadInventory({
            vaultName: 'test-vault'
        });
        expect(listCallCounter).toBe(1);
        expect(initiateJobCounter).toBe(1)

    });

    test('Success - there is existing completed job, zero archives', async () => {
        const vaultName = 'test-vault';
        const vault = vaultOutput(vaultName, undefined);
        let listCallCounter: number = 0;
        AWSMock.mock('Glacier', 'listJobs', (params: void, callback: Function) => {
            const response: ListJobsOutput = {
                JobList: [{
                    Action: 'InventoryRetrieval',
                    VaultARN: vault.VaultARN,
                    Completed: true,
                    JobId: 'SomeRandom'
                }
                ]
            };
            listCallCounter++;
            callback(null, response);
        });


        let getJobOutputCounter: number = 0;
        AWSMock.mock('Glacier', 'getJobOutput', (params: void, callback: Function) => {
            const inventory: TAWSInventoryReport = {
                VaultARN: vault.VaultARN!,
                InventoryDate: '',
                ArchiveList: []

            };
            const response: GetJobOutputOutput = {
                body: JSON.stringify(inventory)
            };
            getJobOutputCounter++;
            callback(null, response);
        });


        let initiateJobCounter: number = 0;
        AWSMock.mock('Glacier', 'initiateJob', (params: void, callback: Function) => {
            const response: InitiateJobOutput = {
                jobId: 'unused'
            };
            initiateJobCounter++;
            callback(null, response);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const result = await manager.loadInventory({
            vaultName
        });
        expect(listCallCounter).toBe(1);
        expect(getJobOutputCounter).toBe(1);
        expect(initiateJobCounter).toBe(0);
    });


    test('Success - there is existing completed job, some archives', async () => {
        const vaultName = 'test-vault';
        const vault = vaultOutput(vaultName, undefined);
        let listCallCounter: number = 0;
        AWSMock.mock('Glacier', 'listJobs', (params: void, callback: Function) => {
            const response: ListJobsOutput = {
                JobList: [{
                    Action: 'InventoryRetrieval',
                    VaultARN: vault.VaultARN,
                    Completed: true,
                    JobId: 'SomeRandom'
                }
                ]
            };
            listCallCounter++;
            callback(null, response);
        });


        let getJobOutputCounter: number = 0;
        AWSMock.mock('Glacier', 'getJobOutput', (params: void, callback: Function) => {
            const inventory: TAWSInventoryReport = {
                VaultARN: vault.VaultARN!,
                InventoryDate: '',
                ArchiveList: [
                    {
                        ArchiveDescription: 'file',
                        ArchiveId: 'some id',
                        CreationDate: '13.8 billion years ago',
                        Size: 33333333333,
                        SHA256TreeHash: 'hashhashhash'
                    }
                ]

            };
            const response: GetJobOutputOutput = {
                body: JSON.stringify(inventory)
            };
            getJobOutputCounter++;
            callback(null, response);
        });


        let initiateJobCounter: number = 0;
        AWSMock.mock('Glacier', 'initiateJob', (params: void, callback: Function) => {
            const response: InitiateJobOutput = {
                jobId: 'unused'
            };
            initiateJobCounter++;
            callback(null, response);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const result = await manager.loadInventory({
            vaultName
        });
        expect(listCallCounter).toBe(1);
        expect(getJobOutputCounter).toBe(1);
        expect(initiateJobCounter).toBe(0);
        expect(result?.archiveList.length).toBe(1);
    });
});