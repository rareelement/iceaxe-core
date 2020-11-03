
import { Glacier } from 'aws-sdk';
import { createWriteStream, WriteStream } from 'fs';
import {
    InitiateJobInput, JobParameters, ListVaultsOutput, ListMultipartUploadsOutput,
    ListJobsOutput, InitiateJobOutput
} from 'aws-sdk/clients/glacier';
import { getLogger } from '../logging/Logger';
import { join } from 'path';
import { FileUploader } from '../utils/FileUploader';
import { TMultipartUpload, TAWSInventoryReport, TArchiveMeta, TInventory, TVault, TRetrievalJob, TInventoryJob } from './model';
import { IceAxeError, IceAxeErrorCode } from './errors';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import { parseArchiveDescription } from '../utils/helpers';

const CHUNK_SIZE = 1048576;
const META_VERSION = 1;

const logger = getLogger({ con: { level: 'debug' } });

export type TGlacierManagerConfig = {
    region: string;
    accountId: string;
    enableLogging?: boolean;
    chunkSize?: number;
};

export class GlacierManager {
    private readonly glacier: Glacier;
    private readonly accountId: string;
    private readonly chunkSize: number;

    constructor(params: TGlacierManagerConfig, glacier?: Glacier) {
        const { region, accountId, chunkSize } = params;
        this.accountId = accountId;
        this.chunkSize = chunkSize || CHUNK_SIZE;

        if (glacier) {
            this.glacier = glacier;
        } else {
            this.glacier = new Glacier({ region });
        }
    }

    public async getVaults(): Promise<TVault[]> {
        try {
            const vaultOutput: ListVaultsOutput = await this.glacier.listVaults({ accountId: this.accountId }).promise();
            const { VaultList } = vaultOutput;
            logger.debug('vaults', VaultList);

            return VaultList &&
                VaultList.map(({ VaultARN, VaultName, NumberOfArchives, SizeInBytes, CreationDate, LastInventoryDate }) =>
                    ({
                        arn: VaultARN,
                        name: VaultName!,
                        numberOfArchives: NumberOfArchives || 0,
                        sizeInBytes: SizeInBytes || 0,
                        creationDate: CreationDate,
                        lastInventoryDate: LastInventoryDate
                    })
                ) || []; // TODO support marker
        } catch (err) {
            logger.error('getVaults', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to load vaults', err);
        }
    }

    public async uploadFile(params: {
        path: string;
        filename: string;
        vaultName: string;
        position?: number;
    }) {
        const { path, filename, vaultName } = params;
        try {
            const uploadMeta = await this.getMultipartUpload({ vaultName, filename });
            logger.debug(`uploadFile/uploadMeta ${JSON.stringify(uploadMeta)}`);

            const fileUploader = new FileUploader(join(path, filename),
                {
                    accountId: this.accountId,
                    vaultName,
                    uploadId: uploadMeta?.multipartUploadId!,
                    chunkSize: this.chunkSize,
                }, this.glacier);

            return fileUploader.upload();
        } catch (err) {
            logger.error('GlacierManager.uploadFile', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to upload file', err);
        }
    }

    /*
    Returns archiveId based on provided filename and archive description.
    The user is responsible for maintaining not more than one version of the file.
    If there are no completed inventory jobs, undefined will be returned even though
    there might exist an archive with such name
    */
    public async getArchiveId(params: {
        vaultName: string;
        filename: string;
    }): Promise<string | undefined> {
        const { vaultName, filename } = params;
        try {
            const inventory: TInventory | undefined = await this.loadInventory({
                vaultName
            });

            if (!inventory)
                return undefined;

            const { archiveList } = inventory;
            const searchedArchive = archiveList.map(
                ({ archiveDescription, archiveId }) => ({
                    meta: archiveDescription && parseArchiveDescription(archiveDescription),
                    archiveId
                })).filter(
                    ({ meta }) => meta && meta.filename === filename
                );
            return searchedArchive && searchedArchive.length > 0 ? searchedArchive[0].archiveId : undefined;

        } catch (err) {
            logger.error('GlacierManager.getArchiveId', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to resolve archiveId', err);
        }
    }

    /*
    Returns existing inventory job or starts a new one
    */
    public async getOrInitiateInventoryJobs(params: {
        vaultName: string;
        returnCompletedOnly?: boolean;
        useExistingJobFirst?: boolean;
    }): Promise<TInventoryJob[] | undefined> {

        const { returnCompletedOnly, useExistingJobFirst, vaultName } = params;
        try {

            if (useExistingJobFirst) {
                const jobListResult: ListJobsOutput = await this.glacier.listJobs(
                    {
                        accountId: this.accountId,
                        vaultName
                    }).promise();

                const inventoryJobs = jobListResult.JobList?.filter(
                    ({ Action, VaultARN, Completed }) => Action === 'InventoryRetrieval' && VaultARN?.split('/').pop() === vaultName
                        && (!returnCompletedOnly || Completed)
                );
                logger.debug(`initiateInventoryJob/inventoryJobs ${JSON.stringify(inventoryJobs)}`);

                if (inventoryJobs && inventoryJobs?.length > 0) {
                    logger.info(`GlacierManager.initiateInventoryJob Found existing inventory job for ${vaultName}`);
                    return inventoryJobs.map(
                        ({ JobId, JobDescription, Completed, CompletionDate }) =>
                            ({
                                jobId: JobId!,
                                description: JobDescription,
                                completed: !!Completed,
                                completionDate: CompletionDate
                            })
                    );
                }

                const allJobs = jobListResult.JobList?.filter(
                    ({ Action, VaultARN }) => Action === 'InventoryRetrieval' && VaultARN?.split('/').pop() === vaultName);

                if (allJobs && allJobs.length) {
                    logger.debug(`There are pending inventory jobs ${allJobs}`);
                    return undefined;
                }
            }

            const jobParameters: JobParameters = {
                Type: 'inventory-retrieval',
            };
            const jobInput: InitiateJobInput = {
                accountId: this.accountId,
                vaultName,
                jobParameters
            };

            logger.info(`GlacierManager.initiateInventoryJob initiating new inventory job for ${vaultName}`);
            const initiateResult: InitiateJobOutput = await this.glacier.initiateJob(jobInput).promise(); // TODO support marker
            return undefined;
        } catch (err) {
            logger.error('GlacierManager.initiateInventoryJob', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to initiate inventory job', err);
        }
    }

    public async getRetrivalJobs(params: {
        vaultName: string;
        archiveId?: string;
        filename?: string;
        returnCompletedOnly: boolean;
    }): Promise<TRetrievalJob[] | undefined> {

        try {
            const { vaultName } = params;
            const jobListResult: ListJobsOutput = await this.glacier.listJobs(
                {
                    accountId: this.accountId,
                    vaultName
                }).promise();
            const archiveRetrievalJobs = jobListResult.JobList?.filter(
                ({ Action, VaultARN, Completed, JobDescription, ArchiveId }) =>
                    Action === 'ArchiveRetrieval' && VaultARN?.split('/').pop() === vaultName &&
                    (JobDescription === params.filename || ArchiveId === params.archiveId) && (!params.returnCompletedOnly || Completed)
            );
            logger.debug(`getRetrivalJob ${JSON.stringify(archiveRetrievalJobs)}`);

            if (archiveRetrievalJobs && archiveRetrievalJobs?.length > 0) {
                logger.info(`GlacierManager.getRetrivalJob archiveRetrieval jobs for ${JSON.stringify(params)} in ${vaultName}`);
                return archiveRetrievalJobs.map(
                    ({ JobId, ArchiveId, Completed, CompletionDate, JobDescription }) => (
                        {
                            jobId: JobId!,
                            archiveId: ArchiveId!,
                            completed: !!Completed,
                            description: JobDescription,
                            completionDate: CompletionDate
                        }
                    )
                );
            }
            logger.info(`GlacierManager.getRetrivalJob initiating new inventory job for ${vaultName}`);

            return undefined;
        } catch (err) {
            logger.error('GlacierManager.getRetrivalJob', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to fetch retrival jobs', err);
        }
    }

    public async deleteArchive(params: {
        vaultName: string;
        archiveId: string;
    }) {
        const { vaultName, archiveId } = params;
        try {
            logger.debug(`deleteArchive ${JSON.stringify(params)}`);
            await this.glacier.deleteArchive({
                accountId: this.accountId,
                vaultName,
                archiveId
            }).promise();
        } catch (err) {
            logger.error('GlacierManager.deleteArchive', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to delete archive', err);
        }
    }

    public async getOrInitiateRetrievalJobs(params: {
        vaultName: string;
        archiveId: string;
        filename: string;
        useExistingJobFirst?: boolean;
        returnCompletedOnly?: boolean;
    }): Promise<TRetrievalJob[] | string | undefined> {

        const { vaultName, returnCompletedOnly, useExistingJobFirst, archiveId, filename } = params;
        try {

            if (useExistingJobFirst) {
                const jobListResult: ListJobsOutput = await this.glacier.listJobs(
                    {
                        accountId: this.accountId,
                        vaultName
                    }).promise();
                const archiveRetrievalJobs = jobListResult.JobList?.filter(
                    ({ Action, VaultARN, Completed, JobDescription }) =>
                        Action === 'ArchiveRetrieval' && VaultARN?.split('/').pop() === vaultName && JobDescription === filename
                        && (!returnCompletedOnly || Completed)
                );
                logger.debug(`initiateRetrievalJob/ArchiveRetrieval ${JSON.stringify(archiveRetrievalJobs)}`);

                if (archiveRetrievalJobs && archiveRetrievalJobs?.length > 0) {
                    logger.info(`GlacierManager.initiateRetrievalJob Found existing ArchiveRetrieval job for ${filename} in ${vaultName}`);
                    const retrievalJobs: TRetrievalJob[] = archiveRetrievalJobs.map(
                        ({ ArchiveId, Completed, JobDescription, JobId, CompletionDate }) => (
                            {
                                archiveId: ArchiveId!,
                                completed: !!Completed,
                                description: JobDescription!,
                                completionDate: CompletionDate,
                                jobId: JobId! // TODO throw exception or ignore if undefined
                            }
                        ));
                    return retrievalJobs;
                }
            }

            const retrivalJob = await this.glacier.initiateJob({
                accountId: this.accountId,
                vaultName,
                jobParameters: {
                    ArchiveId: archiveId,
                    Description: filename,
                    Type: 'archive-retrieval',
                    Tier: 'Bulk', // TODO parametrise
                    // InventoryRetrievalParameters: {
                    // }
                }
            }).promise(); // TODO support marker
            logger.info(`GlacierManager.initiateRetrievalJob initiating new inventory job for ${vaultName}`);

            return retrivalJob.jobId;
        } catch (err) {
            logger.error('GlacierManager.initiateRetrievalJob', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to initiate retrieval', err);
        }
    }

    public async downloadArchive(params: {
        destinationFile: string;
        jobId: string;
        vaultName: string;
    }): Promise<void> {
        const { destinationFile, jobId, vaultName } = params;

        let writableStream: WriteStream | undefined;
        try {

            const pipelinePromise = promisify(pipeline);

            const retrivalJobOutput = await this.glacier.getJobOutput({
                accountId: this.accountId,
                vaultName,
                jobId
            }).promise();

            writableStream = createWriteStream(destinationFile, { autoClose: true });

            if (retrivalJobOutput.body && (retrivalJobOutput.body as Readable).readable) {
                await pipelinePromise(
                    (retrivalJobOutput.body as Readable),
                    writableStream
                );
            } else {
                writableStream.write(retrivalJobOutput.body as Readable);
            }

        } catch (err) {
            logger.error('GlacierManager.downloadArchive', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to download archive', err);
        }
    }

    /*
    Returns the latest inventory or starts a new inventory job in case there are no pending or completed jobs for the vault.
    */
    public async loadInventory(params: { vaultName: string; }): Promise<TInventory | undefined> {
        try {
            const { vaultName } = params;
            const inventoryJobs = await this.getOrInitiateInventoryJobs({ vaultName, useExistingJobFirst: true, returnCompletedOnly: true });

            // no completed inventory job
            if (!inventoryJobs) {
                logger.warn(`GlacierManager.loadInventory No completed inventory jobs found for ${vaultName}`);
                return undefined;
            }

            inventoryJobs.sort(
                (i2, i1) => (i1.completionDate || '').localeCompare((i2.completionDate || ''))
            );
            logger.debug(`loadInventory: Sorted inventoryJobs ${JSON.stringify(inventoryJobs)}`);

            logger.debug(`loadInventory: Latest job ${JSON.stringify(inventoryJobs[0])}`);

            const inventoryJobOutput = await this.glacier.getJobOutput({
                accountId: this.accountId,
                vaultName,
                jobId: inventoryJobs[0].jobId
            }).promise();

            const inventorySerialized = inventoryJobOutput.body && inventoryJobOutput.body.toString();
            const inventory = inventorySerialized && JSON.parse(inventorySerialized) || undefined;
            logger.debug(`GlacierManager.loadInventory inventory=${JSON.stringify(inventory)}`);

            if (inventory) {
                const { ArchiveList, InventoryDate, VaultARN } = inventory as TAWSInventoryReport;
                logger.debug(`GlacierManager.loadInventory archiveList=${JSON.stringify(ArchiveList)}`);
                return {
                    archiveList: ArchiveList.map(
                        ({ ArchiveDescription, ArchiveId, CreationDate, SHA256TreeHash, Size }) => ({
                            archiveId: ArchiveId,
                            archiveDescription: ArchiveDescription,
                            creationDate: CreationDate,
                            size: Size
                        })
                    ),
                    inventoryDate: InventoryDate
                };
            }

        } catch (err) {
            logger.error('GlacierManager.loadInventory', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to fetch inventory', err);
        }
    }

    private async getMultiPartUploads(params: { vaultName: string; }): Promise<TMultipartUpload[]> {
        try {
            const { vaultName } = params;
            const uploadsOutput: ListMultipartUploadsOutput =
                await this.glacier.listMultipartUploads({ accountId: this.accountId, vaultName }).promise();
            const { UploadsList, Marker } = uploadsOutput; // TODO support marker

            return UploadsList && UploadsList.map(
                ({ ArchiveDescription, CreationDate, VaultARN, MultipartUploadId, PartSizeInBytes }) => (
                    {
                        archiveDescription: ArchiveDescription,
                        creationDate: CreationDate,
                        vaultARN: VaultARN,
                        multipartUploadId: MultipartUploadId!,
                        partSizeInBytes: PartSizeInBytes || 0
                    }
                )
            ) || [];
        } catch (err) {
            logger.error('getMultiPartUploads', err);
            return [];
        }
    }

    private async getMultipartUpload(params: { vaultName: string; filename: string; }):
        Promise<TMultipartUpload | undefined> {
        const { vaultName, filename } = params;
        try {
            const uploads = await this.getMultiPartUploads({ vaultName });
            const matchingUpload = uploads.filter(({ archiveDescription }) => {
                let meta: TArchiveMeta | undefined;
                try {
                    meta = archiveDescription && parseArchiveDescription(archiveDescription) || undefined;
                } catch (err) {
                    if ((err as IceAxeError).code === IceAxeErrorCode.UNSUPPORTED_ARCHIVE_DESCRIPTION) {
                        logger.debug('Failed to parse archive description: ' + archiveDescription);
                        return undefined;
                    } else
                        throw err;
                }
                return meta && meta.filename === filename;
            });

            if (matchingUpload.length > 1) {
                logger.error('getMultipartUpload', `More than one archive with filename: ${filename}`);
            }

            if (matchingUpload.length) {// found archive for provided filename
                logger.error('getMultipartUpload/matchingUpload', matchingUpload);
                return matchingUpload[0];
            }

            // create a new multipart upload for the filename
            const description = JSON.stringify({ filename, version: META_VERSION });
            const newUpload = await this.glacier.initiateMultipartUpload({
                accountId: this.accountId,
                vaultName,
                partSize: this.chunkSize.toString(),
                archiveDescription: description
            }).promise();

            const { location, uploadId } = newUpload;
            logger.debug('getMultipartUpload.new-upload', newUpload);
            return {
                archiveDescription: description,
                multipartUploadId: uploadId!,
                partSizeInBytes: this.chunkSize
            };

        } catch (err) {
            logger.error('getMultiPartUploads', err);
            throw new IceAxeError(IceAxeErrorCode.AWS_FAILURE, 'Failed to fetch uploads', err);
        }
    }
}
