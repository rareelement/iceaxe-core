export enum IceAxeErrorCode {
    AWS_FAILURE = 'AWS_FAILURE',
    INTERNAL = 'INTERNAL',
    UNSUPPORTED_ARCHIVE_DESCRIPTION = 'UNSUPPORTED_ARCHIVE_DESCRIPTION'
}

export class IceAxeError extends Error {
    public readonly isIceAxeError = true;

    constructor(public readonly code: IceAxeErrorCode, public readonly msg: string, public readonly source?: Error) {
        super(msg);
    }
}
