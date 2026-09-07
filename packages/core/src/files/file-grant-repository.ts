import { SystemConstants } from '@core/constants/system.constants';
import { GrantTokenService } from '@core/security/grant-token-service';
import type { GrantOutcome } from '@core/security/enums/grant-outcome.enum';
import type { IFileGrantRecord } from '@core/files/interfaces/file-grant-record.interface';
import type { IFileShareRecord } from '@core/files/interfaces/file-share-record.interface';

/**
 * Data access for file shares and their per-recipient grants.
 *
 * Framework internals go through the raw database manager, so columns here are snake_case — the
 * camelCase rule applies to plugin code reading through the context proxy, not to this layer.
 *
 * Nothing in this class decides whether access is allowed; it loads rows and records what happened.
 * The decision lives in `GrantTokenService.evaluate`, which is pure, so the two can be tested apart.
 */
export class FileGrantRepository {
  constructor(private readonly db: any) {}

  /**
   * The grant for a raw token, found by hashing it. The raw value is never stored, so there is no
   * lookup that could match on it directly and no query that logs it.
   */
  async findGrantByToken(rawToken: string): Promise<IFileGrantRecord | null> {
    const tokenHash = GrantTokenService.hash(rawToken);
    const row = await this.db.findOne(SystemConstants.TABLE.FILE_GRANTS, { token_hash: tokenHash });
    return row ? FileGrantRepository.toGrant(row) : null;
  }

  async findShare(shareId: number): Promise<IFileShareRecord | null> {
    const row = await this.db.findOne(SystemConstants.TABLE.FILE_SHARES, { id: shareId });
    return row ? FileGrantRepository.toShare(row) : null;
  }

  async listGrantsForShare(shareId: number): Promise<IFileGrantRecord[]> {
    const rows = await this.db.find(SystemConstants.TABLE.FILE_GRANTS, { where: { share_id: shareId } });
    return (Array.isArray(rows) ? rows : []).map(FileGrantRepository.toGrant);
  }

  /** Every grant issued to an address — what the account panel shows a signed-in recipient. */
  async listGrantsForEmail(email: string): Promise<IFileGrantRecord[]> {
    const rows = await this.db.find(SystemConstants.TABLE.FILE_GRANTS, {
      where: { email: String(email || '').trim().toLowerCase() },
    });
    return (Array.isArray(rows) ? rows : []).map(FileGrantRepository.toGrant);
  }

  async createShare(input: {
    title: string;
    message: string;
    mediaIds: number[];
    resourceType?: string;
    resourceIds?: string[];
    createdBy: number | null;
  }): Promise<number> {
    const inserted = await this.db.insert(SystemConstants.TABLE.FILE_SHARES, {
      title: input.title,
      message: input.message,
      media_ids: JSON.stringify(input.mediaIds || []),
      resource_type: String(input.resourceType || ''),
      resource_ids: JSON.stringify(input.resourceIds || []),
      created_by: input.createdBy,
    });
    return Number(inserted?.id);
  }

  /** Returns the RAW token for the caller to put in one email. It is not recoverable afterwards. */
  async createGrant(input: {
    shareId: number;
    email: string;
    userId: number | null;
    expiresAt: string | null;
    maxDownloads: number;
    requireConfirmation: boolean;
    requireAccount: boolean;
  }): Promise<{ id: number; rawToken: string }> {
    const { raw, hash } = GrantTokenService.mint();
    const inserted = await this.db.insert(SystemConstants.TABLE.FILE_GRANTS, {
      share_id: input.shareId,
      email: String(input.email || '').trim().toLowerCase(),
      user_id: input.userId,
      token_hash: hash,
      expires_at: input.expiresAt,
      max_downloads: Number(input.maxDownloads || 0),
      download_count: 0,
      require_confirmation: input.requireConfirmation ? 1 : 0,
      require_account: input.requireAccount ? 1 : 0,
    });
    return { id: Number(inserted?.id), rawToken: raw };
  }

  /**
   * Counts a download against the cap.
   *
   * The current count is part of the WHERE, so two concurrent downloads cannot both read 4, both write
   * 5, and slip past a cap of 5 — the second update matches no row and reports the conflict. Same
   * optimistic-locking shape the commerce plugins use on money and stock.
   */
  async recordDownload(grantId: number, currentCount: number, ip: string): Promise<boolean> {
    const updated = await this.db.update(
      SystemConstants.TABLE.FILE_GRANTS,
      { id: grantId, download_count: currentCount },
      { download_count: currentCount + 1, last_access_at: new Date().toISOString(), last_access_ip: ip },
    );
    return Boolean(updated);
  }

  /**
   * Changes what an ISSUED link permits — a longer deadline, a bigger allowance, a stricter policy.
   *
   * This is the reason the token is a row rather than a signed blob: the same link keeps working while
   * its terms change, so extending a share does not mean emailing everyone a second URL and hoping they
   * use the right one. Only the fields the caller names are touched.
   *
   * A REVOKED grant is not editable. Revocation is the operator's deliberate, final act; quietly
   * reviving a link by editing it would make "revoked" mean nothing. Re-issue instead.
   */
  async updateGrant(grantId: number, patch: {
    expiresAt?: string | null;
    maxDownloads?: number;
    requireConfirmation?: boolean;
    requireAccount?: boolean;
  }): Promise<boolean> {
    const columns: Record<string, unknown> = {};
    if (patch.expiresAt !== undefined) columns.expires_at = patch.expiresAt;
    if (patch.maxDownloads !== undefined) columns.max_downloads = Math.max(0, Number(patch.maxDownloads) || 0);
    if (patch.requireConfirmation !== undefined) columns.require_confirmation = patch.requireConfirmation ? 1 : 0;
    if (patch.requireAccount !== undefined) columns.require_account = patch.requireAccount ? 1 : 0;
    if (!Object.keys(columns).length) return false;

    // Read-then-check, NOT `where: { revoked_at: null }`. A null in a `where` becomes `column = ?` with a
    // NULL parameter, which is never true in SQL — the guard would silently match nothing and every edit
    // would report "0 links updated". Verified in the browser before this was written this way.
    const existing = await this.db.findOne(SystemConstants.TABLE.FILE_GRANTS, { id: grantId });
    if (!existing || existing.revoked_at || existing.revokedAt) return false;

    return Boolean(await this.db.update(SystemConstants.TABLE.FILE_GRANTS, { id: grantId }, columns));
  }

  async updateShare(shareId: number, patch: { title?: string; message?: string }): Promise<boolean> {
    const columns: Record<string, unknown> = {};
    if (patch.title !== undefined) columns.title = patch.title;
    if (patch.message !== undefined) columns.message = patch.message;
    if (!Object.keys(columns).length) return false;
    return Boolean(await this.db.update(SystemConstants.TABLE.FILE_SHARES, { id: shareId }, columns));
  }

  /**
   * What actually happened to a share: every open, every download, every refusal.
   *
   * Refusals matter as much as successes — a run of `expired` hits on one grant is how an operator
   * learns a link is still circulating past its welcome, and `unknown` hits are how they learn someone
   * is guessing. Newest first, because the question is almost always "what just happened".
   */
  async listAccessLog(grantIds: number[], limit = 200): Promise<Array<Record<string, unknown>>> {
    if (!grantIds.length) return [];
    const rows: Array<Record<string, unknown>> = [];
    for (const grantId of grantIds) {
      const found = await this.db.find(SystemConstants.TABLE.FILE_ACCESS_LOG, {
        where: { grant_id: grantId },
        orderBy: { id: 'desc' },
        limit,
      });
      rows.push(...(Array.isArray(found) ? found : []));
    }
    return rows
      .sort((a, b) => Number(b.id) - Number(a.id))
      .slice(0, limit);
  }

  async revokeGrant(grantId: number): Promise<void> {
    await this.db.update(SystemConstants.TABLE.FILE_GRANTS, { id: grantId }, { revoked_at: new Date().toISOString() });
  }

  async revokeShare(shareId: number): Promise<void> {
    const revokedAt = new Date().toISOString();
    for (const grant of await this.listGrantsForShare(shareId)) {
      if (!grant.revokedAt) {
        await this.db.update(SystemConstants.TABLE.FILE_GRANTS, { id: grant.id }, { revoked_at: revokedAt });
      }
    }
  }

  /**
   * The audit trail. Refusals are logged as well as successes — a run of `expired` hits on one grant is
   * how an operator learns a link is circulating past its welcome. The raw token is never written here.
   */
  async logAccess(input: { grantId: number | null; shareId: number | null; mediaId: number | null; outcome: GrantOutcome; ip: string; userAgent: string }): Promise<void> {
    if (input.mediaId === null && await this.hasRecentView(input.grantId, input.ip, input.outcome)) return;

    await this.db.insert(SystemConstants.TABLE.FILE_ACCESS_LOG, {
      grant_id: input.grantId,
      share_id: input.shareId,
      media_id: input.mediaId,
      outcome: input.outcome.value,
      ip: input.ip,
      user_agent: String(input.userAgent || '').slice(0, 512),
    });
  }

  /**
   * Has this grant already been recorded opening the page, from this address, moments ago?
   *
   * One page view was producing TWO rows — measured: 10 opens, 20 rows — so every count derived from
   * this table was double. The log is a record of VIEWS, not of HTTP requests: a page that fetches
   * twice, a refresh, a client retry are all one person looking once, and counting them separately made
   * "opened" meaningless.
   *
   * Downloads are never collapsed. Each one is a deliberate act and each one spends the allowance.
   */
  private async hasRecentView(grantId: number | null, ip: string, outcome: GrantOutcome): Promise<boolean> {
    if (!ip) return false;

    // Queried by IP, never by grant. `grant_id` is NULL for an unknown token, and a null in a `where`
    // becomes `column = ?` with a NULL parameter, which is never true in SQL — the lookup would silently
    // match nothing and every refused view would double-log while valid ones did not.
    const rows = await this.db.find(SystemConstants.TABLE.FILE_ACCESS_LOG, {
      where: { ip, outcome: outcome.value },
      orderBy: { id: 'desc' },
      limit: 5,
    });

    const cutoff = Date.now() - FileGrantRepository.VIEW_COLLAPSE_MS;

    return (Array.isArray(rows) ? rows : []).some((row: any) => {
      if (row?.media_id !== null && row?.media_id !== undefined) return false;
      // Same visitor AND the same grant — including "no grant at all", so two different bad tokens are
      // still two events.
      if (Number(row?.grant_id ?? row?.grantId ?? 0) !== Number(grantId ?? 0)) return false;

      const at = String(row?.created_at ?? row?.createdAt ?? '');
      // Compared as instants, not as strings: the column holds `CURRENT_TIMESTAMP` as
      // 'YYYY-MM-DD HH:MM:SS' while ISO strings sort differently ('T' > ' ').
      const stamp = new Date(at.includes('T') ? at : `${at.replace(' ', 'T')}Z`);
      return !Number.isNaN(stamp.getTime()) && stamp.getTime() >= cutoff;
    });
  }

  /** Two requests a second apart are one person opening the page once. */
  private static readonly VIEW_COLLAPSE_MS = 10_000;

  private static toGrant(row: any): IFileGrantRecord {
    return {
      id: Number(row?.id),
      shareId: Number(row?.share_id ?? row?.shareId),
      email: String(row?.email || ''),
      userId: row?.user_id ?? row?.userId ?? null,
      tokenHash: String(row?.token_hash ?? row?.tokenHash ?? ''),
      expiresAt: row?.expires_at ?? row?.expiresAt ?? null,
      maxDownloads: Number(row?.max_downloads ?? row?.maxDownloads ?? 0),
      downloadCount: Number(row?.download_count ?? row?.downloadCount ?? 0),
      requireConfirmation: Boolean(Number(row?.require_confirmation ?? row?.requireConfirmation ?? 0)),
      requireAccount: Boolean(Number(row?.require_account ?? row?.requireAccount ?? 0)),
      revokedAt: row?.revoked_at ?? row?.revokedAt ?? null,
      lastAccessAt: row?.last_access_at ?? row?.lastAccessAt ?? null,
      lastAccessIp: row?.last_access_ip ?? row?.lastAccessIp ?? null,
    };
  }

  private static toShare(row: any): IFileShareRecord {
    return {
      id: Number(row?.id),
      title: String(row?.title || ''),
      message: String(row?.message || ''),
      mediaIds: FileGrantRepository.parseMediaIds(row?.media_ids ?? row?.mediaIds),
      resourceType: String(row?.resource_type ?? row?.resourceType ?? ''),
      resourceIds: FileGrantRepository.parseResourceIds(row?.resource_ids ?? row?.resourceIds),
      createdBy: row?.created_by ?? row?.createdBy ?? null,
    };
  }

  /** Record ids stay STRINGS: a plugin's key may not be numeric, and the framework never interprets them. */
  private static parseResourceIds(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean);
    try {
      const parsed = JSON.parse(String(value ?? '[]'));
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  /** A malformed list yields no files rather than throwing — a corrupt row must not 500 the page. */
  private static parseMediaIds(value: unknown): number[] {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    try {
      const parsed = JSON.parse(String(value ?? '[]'));
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  }
}
