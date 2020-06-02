# IceAxe

## Unofficial TypeScript AWS Glacier Client library

The library is being actively developed. Therefore, breaking changes are very probable.

### Installation

Install npm package:
```
npm i @rareelements/iceaxe-core
```

The library uses named AWS profiles to connect to your AWS account (https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html)
Before you execute your code, set AWS_PROFILE variable value to the named profile you want to use.

```
export AWS_PROFILE=initech_prod
```

It must have required Glacier access permissions.

### Usage example

Instantiate GlacierManager:
```
import { GlacierManager } from '@rareelements/iceaxe-core';

...
    const manager = new GlacierManager({ region: 'ca-central-1', accountId: '-' });

```

> The AccountId value is the AWS account ID of the account that owns the vault. You can either specify an AWS account ID or optionally a single '-' (hyphen), in which case Amazon S3 Glacier uses the AWS account ID associated with the credentials used to sign the request. If you use an account ID, do not include any hyphens ('-') in the ID. 
https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Glacier.html



Load vault inventory (as a side starts a new inventory job in case there are pending jobs):
```
import { GlacierManager } from '@rareelements/iceaxe-core';

(
    async () => {
        const manager = new GlacierManager({ region: 'ca-central-1', accountId: '-' });
        const inventory: TInventory | undefined = await manager.loadInventory({ vaultName: 'test-ak' });
    }
)();

```

Upload file (note, that we rely on user removing any previous upload(s) of the same file as there is no way to synchroneously fetch vault inventory):
```

    const uploadParams = {
        filename: 'application-backup-20230601.zip', // filename, if it will be preserved in archive metadata
        path: '/home/initech/backups', // location of the file
        vaultName: 'initech-backups' // target AWS Glacier vault
    };

    await manager.uploadFile(uploadParams);

```

Resolve archiveId for the file (depends on availability of completed inventory job):
```

    const params = {
        vaultName: 'initech-backups'
        filename: 'application-backup-20230601.zip'
    };

    const archiveId : string | undefined = await manager.getArchiveId(params);

```

Delete archive:
```

    const params = {
        vaultName: 'initech-backups',
        archiveId: '6xu5ZPXpnTed-e8w2CUrZpgRo2O5D6t-TYAPA3OYJg324g34g234sUgInvVCJ3eyZ658tK3EPDA_KpGQLVvreg234g34PuawsAbu-LJDQ'
    };

    await manager.deleteArchive(params);

```

Initiate file download job:
```

    const params = {
        vaultName: 'initech-backups'
        filename: 'application-backup-20230601.zip',
        archiveId: '6xu5ZPXpnTed-e8w2CUrZpgRo2O5D6t-TYAPA3OYJg324g34g234sUgInvVCJ3eyZ658tK3EPDA_KpGQLVvreg234g34PuawsAbu-LJDQ'
        filename: 'application-backup-20230601.zip'
        useExistingJobFirst: true // set to false if you want to create a new retrieval job
    };

    const result: TRetrievalJob[] | string | undefined = await manager.getOrInitiateRetrievalJob(params);

```
If there are matching retrieval jobs for the fhe file, they will be returned. Otherwise a new job will be started and the corresponding jobId will be returned.

Download archive (only if corresponding job has been completed):
```

    const params = {
        vaultName: 'initech-backups',
        destinationFile: '/home/initech/restored_backups/application-backup-20230601.zip',
        jobId: h-wIijiTEUIfavsdvsdvasqXDxSp5Y1t1I_XFZbGRXxabdorNO9EJ6ZiPOTBfkfHWic-nJNKKVTp_dUgpmczH'
    })

    await manager.downloadArchive(params);

```



DISCLAIMER: This library, code samples and the documentation are provided "as is" without warranty of any kind, either express or implied. Use at your own risk.

We make makes no warranty that

- the software will meet your requirements
- the software will be uninterrupted, timely, secure or error-free
- the results that may be obtained from the use of the software will be effective, accurate or reliable
- the quality of the software will meet your expectations
- any errors in the software obtained from us will be corrected.

We assume no responsibility for errors or omissions in the software or documentation.

