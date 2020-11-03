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

export interface IOProcessStatus {
    currentOffset: number;
    completed: boolean;
}

export interface IOProcessController {
    abort(): Promise<void>;
    status(): Promise<IOProcessStatus>;
    addStatusListener(handler: (status: IOProcessStatus) => Promise<void>): Promise<void>;
}

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

export type TArchiveItem = {
    archiveId: string;
    archiveDescription?: string;
    creationDate: string;
    size: number;
};

export type TInventory = {
    inventoryDate: string;
    archiveList: TArchiveItem[];
};

export type TRetrievalJob = {
    jobId: string;
    archiveId: string;
    completed: boolean;
    description?: string;
    completionDate?: string;
};

export type TInventoryJob = {
    jobId: string;
    completed: boolean;
    description?: string;
    completionDate?: string;
};
