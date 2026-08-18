import { SystemConstants } from '@core/constants/system.constants';
import { GrantOutcome } from '@core/security/enums/grant-outcome.enum';
import { FileGrantRepository } from '@core/files/file-grant-repository';
import { GrantTokenService } from '@core/security/grant-token-service';
import type { IFileGrantRecord } from '@core/files/interfaces/file-grant-record.interface';
import type { IFileShareResolution } from '@core/files/interfaces/file-share-resolution.interface';

/**
 * Turns a raw token into "what may this caller see, and why".
 *
 * The one rule that shapes everything here: a refusal tells the visitor nothing. `resolve` returns the
 * specific outcome so it can be logged and shown to the operator, but the caller is expected to render
 * every non-granted, non-actionable outcome identically — no file names, no "this expired on the 3rd".
 * The listing is therefore only ever populated on a granted resolution.
 */
export class FileShareAccessService {
  constructor(private readonly db: any, private readonly grants: FileGrantRepository) {}

  /**
   * Resolve a token for VIEWING the share (the landing page).
   *
   * `signedInEmail` is the address of the logged-in user, if any — it is read from the session by the
   * caller and never from the request body, so a grant that requires an account cannot be opened by
   * asserting someone else's address.
   */
  async resolveForView(rawToken: string, signedInEmail: string | null, confirmedGrantIds: number[] = []): Promise<IFileShareResolution> {
    const grant = await this.grants.findGrantByToken(rawToken);
    const outcome = this.gate(grant, signedInEmail, confirmedGrantIds);

    if (!outcome.isGranted || !grant) {
      return { outcome, grant: grant ?? null, share: null, files: [] };
    }

    const share = await this.grants.findShare(grant.shareId);
    if (!share) {
      // The grant outlived its share. Nothing to serve, and nothing worth distinguishing for the
      // visitor — treat it as an unknown link.
      return { outcome: GrantOutcome.UNKNOWN, grant, share: null, files: [] };
    }

    return { outcome, grant, share, files: await this.loadFiles(share.mediaIds) };
  }

  /**
   * Resolve a token for DOWNLOADING one file, which additionally requires that the file actually
   * belongs to this share. Without that check a valid token would be a key to the entire media
   * library — the classic mistake of authorizing the token and then trusting the id beside it.
   */
  async resolveForDownload(
    rawToken: string,
    mediaId: number,
    signedInEmail: string | null,
    confirmedGrantIds: number[] = [],
  ): Promise<IFileShareResolution> {
    const resolution = await this.resolveForView(rawToken, signedInEmail, confirmedGrantIds);
    if (!resolution.outcome.isGranted) return resolution;

    const belongs = (resolution.share?.mediaIds || []).includes(Number(mediaId));
    if (!belongs) return { ...resolution, outcome: GrantOutcome.UNKNOWN, files: [] };

    return { ...resolution, files: resolution.files.filter((f) => Number(f.id) === Number(mediaId)) };
  }

  /**
   * Counts one download. Returns false when the optimistic update lost a race, which the caller must
   * treat as a refusal — otherwise two simultaneous requests both serve the last permitted download.
   */
  async countDownload(grant: IFileGrantRecord, ip: string): Promise<boolean> {
    return this.grants.recordDownload(grant.id, grant.downloadCount, ip);
  }

  /**
   * Expiry, revocation and the download cap, decided by the framework's shared evaluator.
   *
   * The evaluator counts "uses"; this feature counts downloads. Adapting the two names here — once,
   * statically, for every caller including the download route — is what keeps the rule itself in one
   * place instead of restated per feature.
   */
  static evaluateGrant(grant: IFileGrantRecord | null | undefined): GrantOutcome {
    if (!grant) return GrantOutcome.UNKNOWN;
    return GrantTokenService.evaluate({
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
      maxUses: grant.maxDownloads,
      useCount: grant.downloadCount,
    });
  }

  /**
   * The policy checks the pure evaluator cannot make, because they depend on the caller rather than the
   * row: is this the right person, and has this browser passed the emailed code.
   */
  private gate(grant: IFileGrantRecord | null, signedInEmail: string | null, confirmedGrantIds: number[]): GrantOutcome {
    const base = FileShareAccessService.evaluateGrant(grant);
    if (!base.isGranted || !grant) return base;

    if (grant.requireAccount) {
      const caller = String(signedInEmail || '').trim().toLowerCase();
      if (!caller || caller !== grant.email.trim().toLowerCase()) return GrantOutcome.ACCOUNT_REQUIRED;
    }

    if (grant.requireConfirmation && !confirmedGrantIds.includes(grant.id)) {
      return GrantOutcome.CONFIRMATION_REQUIRED;
    }

    return GrantOutcome.GRANTED;
  }

  /** Media rows for the share, in the order the operator chose. Missing ids are skipped, not faked. */
  private async loadFiles(mediaIds: number[]): Promise<Array<{ id: number; name: string; path: string; visibility: string; size: number; mimeType: string }>> {
    const files: Array<{ id: number; name: string; path: string; visibility: string; size: number; mimeType: string }> = [];

    for (const mediaId of mediaIds) {
      const row = await this.db.findOne(SystemConstants.TABLE.MEDIA, { id: mediaId });
      if (!row) continue;
      files.push({
        id: Number(row.id),
        name: String(row.original_name || row.originalName || row.filename || ''),
        path: String(row.path || ''),
        visibility: String(row.visibility || 'public'),
        size: Number(row.file_size ?? row.fileSize ?? 0),
        mimeType: String(row.mime_type || row.mimeType || 'application/octet-stream'),
      });
    }

    return files;
  }
}
