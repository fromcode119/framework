import type { GrantOutcome } from '@core/security/enums/grant-outcome.enum';
import type { IFileGrantRecord } from '@core/files/interfaces/file-grant-record.interface';
import type { IFileShareRecord } from '@core/files/interfaces/file-share-record.interface';

/**
 * What a token resolved to.
 *
 * `files` is populated ONLY when `outcome.isGranted`. That is the type carrying the disclosure rule:
 * a refused resolution has nothing to leak, so a caller cannot accidentally render the contents of a
 * share whose link has expired.
 *
 * `grant` may be present on a refusal — a revoked grant is still the row we want in the access log —
 * but `share` and `files` are not.
 */
export interface IFileShareResolution {
  outcome: GrantOutcome;
  grant: IFileGrantRecord | null;
  share: IFileShareRecord | null;
  files: Array<{ id: number; name: string; path: string; visibility: string; size: number; mimeType: string }>;
}
