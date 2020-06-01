import { IceAxeError, IceAxeErrorCode } from '../manager/errors';
import { TArchiveMeta } from '../manager/model';

export function parseArchiveDescription(value: string): TArchiveMeta | undefined {
    try {
        const parsed = JSON.parse(value);

        if (parsed.version && parsed.filename)
            return parsed;

    } catch (err) {
        throw new IceAxeError(IceAxeErrorCode.UNSUPPORTED_ARCHIVE_DESCRIPTION, 'Failed to parse archive description');
    }
}
