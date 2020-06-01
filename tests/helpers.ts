import { DescribeVaultOutput } from 'aws-sdk/clients/glacier';

export const TEST_FILENAME = '../resources/sample.bin';

export const vaultOutput = (vaultName: string, archives?: number) => {
    const data: DescribeVaultOutput = {
        VaultARN: `arn:aws:glacier:ca-central-1:7777777777777777:vaults/${vaultName}`,
        VaultName: vaultName,
        NumberOfArchives: archives || 2,
        SizeInBytes: 1000,
        CreationDate: '2020-05-11T16:13:06.834Z',
        LastInventoryDate: undefined
    };
    return data;
};
