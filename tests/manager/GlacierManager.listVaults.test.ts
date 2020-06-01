import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import { GlacierManager } from '../../src/manager/GlacierManager';
import { vaultOutput } from '../helpers';
import { ListVaultsOutput } from 'aws-sdk/clients/glacier';

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

        AWSMock.mock('Glacier', 'listVaults', (params: void, callback: Function) => {
            callback(null, result);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const vaults = await manager.getVaults();
        expect(vaults).toStrictEqual([]);
    });

    test('Success test with undefined vaults', async () => {
        // mock AWS API call
        const result: ListVaultsOutput = {
            VaultList: undefined
        };

        AWSMock.mock('Glacier', 'listVaults', (params: void, callback: Function) => {
            callback(null, result);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const vaults = await manager.getVaults();
        expect(vaults).toStrictEqual([]);
    });

    test('Success test with 1 vault', async () => {
        // mock AWS API call
        const vault1 = vaultOutput('test1', 2);
        const result: ListVaultsOutput = {
            VaultList: [vault1]
        };

        AWSMock.mock('Glacier', 'listVaults', (params: void, callback: Function) => {
            callback(null, result);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const vaults = await manager.getVaults();
        expect(vaults).toStrictEqual([{
            arn: vault1.VaultARN,
            creationDate: vault1.CreationDate,
            lastInventoryDate: undefined,
            name: vault1.VaultName,
            numberOfArchives: 2,
            sizeInBytes: 1000,
        }]);
    });

    test('Success test with 2 vaults', async () => {

        // mock AWS API call
        const vault1 = vaultOutput('test2', 3);
        const vault2 = vaultOutput('test3', 4);
        const result: ListVaultsOutput = {
            VaultList: [vault1, vault2]
        };

        AWSMock.mock('Glacier', 'listVaults', (params: void, callback: Function) => {
            callback(null, result);
        });

        const manager = new GlacierManager({ accountId: 'test', region: 'test', enableLogging: true }, new AWS.Glacier());
        const vaults = await manager.getVaults();

        expect(vaults).toEqual([{
            arn: vault1.VaultARN,
            creationDate: vault1.CreationDate,
            lastInventoryDate: undefined,
            name: vault1.VaultName,
            numberOfArchives: vault1.NumberOfArchives,
            sizeInBytes: 1000,
        },
        {
            arn: vault2.VaultARN,
            creationDate: vault2.CreationDate,
            lastInventoryDate: undefined,
            name: vault2.VaultName,
            numberOfArchives: vault2.NumberOfArchives,
            sizeInBytes: 1000,
        }]);

    });

});