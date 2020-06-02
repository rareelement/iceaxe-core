export type TVault = {
    arn?: string;
    name: string;
    numberOfArchives: number;
    sizeInBytes: number;
    creationDate?: string;
    lastInventoryDate?: string;
};

export type TMultipartUpload = {
    archiveDescription?: string;
    creationDate?: string;
    vaultARN?: string;
    multipartUploadId: string;
    partSizeInBytes: number;
};

export type TArchiveMeta = {
    version: number; // metadata format version
    filename: string; // filename
};

export type TAWSArchiveItem = {
    ArchiveId: string;
    ArchiveDescription?: string;
    CreationDate: string;
    Size: number;
    SHA256TreeHash: string;
};

export type TAWSInventoryReport = {
    VaultARN: string;
    InventoryDate: string;
    ArchiveList: TAWSArchiveItem[];
};

export type TInventory = {
    inventoryDate: string;
    archiveList: Array<{
        archiveId: string;
        archiveDescription?: string;
        creationDate: string;
        size: number;
    }>;
};

export type TRetrievalJob = {
    archiveId: string;
    completed: boolean;
    description: string;
    jobId: string;
};
