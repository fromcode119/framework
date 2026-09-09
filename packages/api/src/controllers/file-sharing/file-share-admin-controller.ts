import { Response } from 'express';
import { BaseController, PluginManager, Logger, ApplicationUrlUtils, CoercionUtils, FileActivityService, FileGrantRepository, FileSharePageSlug, SystemConstants } from '@fromcode119/core';
import { FileShareEmailService } from '@api/services/file-share-email-service';

/**
 * The operator's side: compose a send, see who has opened it, withdraw it.
 *
 * The revoke routes exist here because a link an operator cannot withdraw is not really revocable.
 * One plugin shipped exactly that — a DELETE endpoint with no list route and no UI, so the token id was
 * only ever visible in the one-time create response and revocation was unreachable in practice. A list
 * and a revoke ship together or neither is real.
 */
import { FileShareRequestParsers } from '@api/controllers/file-sharing/file-share-request-parsers';

export class FileShareAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'file-share-admin' });
  private readonly db: any;
  private readonly grants: FileGrantRepository;
  private readonly emails: FileShareEmailService;
  private readonly activity: FileActivityService;

  constructor(private manager: PluginManager, private settingsCache: Map<string, string>) {
    super();
    this.db = (manager as any).db;
    this.grants = new FileGrantRepository(this.db);
    this.emails = new FileShareEmailService(manager);
    this.activity = new FileActivityService(this.db);
  }

  private setting(key: string, fallback: number): number {
    const raw = this.settingsCache.get(key);
    return raw === undefined || raw === '' ? fallback : Number(raw);
  }

  /**
   * Expiry as an absolute instant, computed once at creation.
   *
   * `0` days means never — the one convention across this model. Stored as an ISO string so the reader
   * can compare it in JS; SQLite would sort a `datetime('now')` default and an ISO string differently.
   */
  private resolveExpiry(days: number): string | null {
    if (!Number.isFinite(days) || days <= 0) return null;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  async createShare(req: any, res: Response): Promise<Response> {
    const title = CoercionUtils.toString(req.body?.title);
    const message = CoercionUtils.toString(req.body?.message);
    const mediaIds = (Array.isArray(req.body?.mediaIds) ? req.body.mediaIds : []).map(Number).filter(Number.isFinite);
    const recipients = (Array.isArray(req.body?.recipients) ? req.body.recipients : [])
      .map((value: unknown) => CoercionUtils.toKey(value))
      .filter((value: string) => value.includes('@'));

    if (!title) return res.status(400).json({ error: 'A title is required.' });
    if (!mediaIds.length) return res.status(400).json({ error: 'Select at least one file.' });
    if (!recipients.length) return res.status(400).json({ error: 'Add at least one recipient.' });

    const expiryDays = req.body?.expiryDays === undefined
      ? this.setting(SystemConstants.META_KEY.FILE_SHARE_DEFAULT_EXPIRY_DAYS, 30)
      : Number(req.body.expiryDays);
    const maxDownloads = req.body?.maxDownloads === undefined
      ? this.setting(SystemConstants.META_KEY.FILE_SHARE_DEFAULT_MAX_DOWNLOADS, 0)
      : Number(req.body.maxDownloads);

    const shareId = await this.grants.createShare({
      title,
      message,
      mediaIds,
      createdBy: Number(req.user?.id) || null,
    });

    const expiresAt = this.resolveExpiry(expiryDays);
    const results: Array<{ email: string; sent: boolean }> = [];

    for (const email of recipients) {
      const { rawToken } = await this.grants.createGrant({
        shareId,
        email,
        userId: null,
        expiresAt,
        maxDownloads,
        requireConfirmation: Boolean(req.body?.requireConfirmation),
        requireAccount: Boolean(req.body?.requireAccount),
      });

      // The raw token exists only here. Once this loop moves on it is unrecoverable — which is why the
      // send failure below is reported rather than swallowed: the operator must know to reissue.
      const sent = await this.emails.sendShareLink({ email, title, message, rawToken, expiresAt, maxDownloads });
      results.push({ email, sent });
    }

    const failed = results.filter((r) => !r.sent).map((r) => r.email);
    if (failed.length) {
      this.logger.warn(`Share ${shareId}: ${failed.length} of ${results.length} emails failed to send`);
    }

    return res.json({ id: shareId, recipients: results, failedRecipients: failed });
  }

  /**
   * Sent shares, each carrying the NAMES of its files and a recipient count.
   *
   * A row that says only "2 files" is useless for the one question this screen exists to answer — which
   * files did we send, and to whom. The ids are already on the row; resolving them to names here costs
   * one lookup per file and is what makes the list readable.
   */
  async listShares(req: any, res: Response): Promise<Response> {
    // Paged: each row costs a grants query and a name lookup per file, so an unbounded list is not
    // slow at scale — it is a page that stops loading. One extra row is fetched purely to answer
    // "is there more", and never returned.
    const limit = Math.min(100, Math.max(1, CoercionUtils.toNumber(req.query?.limit, 20)));
    const offset = Math.max(0, CoercionUtils.toNumber(req.query?.offset, 0));
    const rows = await this.db.find(SystemConstants.TABLE.FILE_SHARES, { orderBy: { id: 'desc' }, limit: limit + 1, offset });
    const pageRows = (Array.isArray(rows) ? rows : []).slice(0, limit);
    const hasMore = (Array.isArray(rows) ? rows : []).length > limit;

    const shares: any[] = [];
    for (const row of pageRows) {
      const mediaIds = FileShareRequestParsers.parseMediaIds(row.media_ids ?? row.mediaIds);
      const grants = await this.grants.listGrantsForShare(Number(row.id));

      shares.push({
        id: row.id,
        title: String(row.title || ''),
        message: String(row.message || ''),
        createdAt: row.created_at ?? row.createdAt ?? null,
        files: await this.resolveFileNames(mediaIds),
        recipientCount: grants.length,
        activeCount: grants.filter((grant) => !grant.revokedAt).length,
      });
    }

    return res.json({ data: shares, hasMore });
  }

  /**
   * Name, kind, and the public URL if the file still has one.
   *
   * A shared file is usually PRIVATE by then, and a private file has no public URL at all, so `url` is
   * empty for those — `isPrivate` is what tells the admin UI to fetch the thumbnail through its own
   * guarded route instead. No storage path is ever returned.
   */
  private async resolveFileNames(mediaIds: number[]): Promise<Array<{ id: number; name: string; mimeType: string; isPrivate: boolean; url: string }>> {
    const files: Array<{ id: number; name: string; mimeType: string; isPrivate: boolean; url: string }> = [];

    for (const mediaId of mediaIds) {
      const row = await this.db.findOne(SystemConstants.TABLE.MEDIA, { id: mediaId });
      if (!row) continue;

      const isPrivate = String(row.visibility || 'public') === 'private';
      files.push({
        id: Number(row.id),
        name: String(row.original_name || row.originalName || row.filename || ''),
        mimeType: String(row.mime_type || row.mimeType || ''),
        isPrivate,
        url: isPrivate ? '' : String(row.path || ''),
      });
    }

    return files;
  }

  /** The same terms applied to every link in a share, plus its title and message. */
  async updateShare(req: any, res: Response): Promise<Response> {
    const shareId = Number(req.params.shareId);
    const title = req.body?.title === undefined ? undefined : CoercionUtils.toString(req.body.title);
    const message = req.body?.message === undefined ? undefined : CoercionUtils.toString(req.body.message);
    if (title !== undefined && !title) return res.status(400).json({ error: 'A title is required.' });

    await this.grants.updateShare(shareId, { title, message });

    const patch = FileShareRequestParsers.readGrantPatch(req.body);
    let changed = 0;
    if (Object.keys(patch).length) {
      for (const grant of await this.grants.listGrantsForShare(shareId)) {
        if (await this.grants.updateGrant(grant.id, patch)) changed += 1;
      }
    }

    return res.json({ success: true, grantsChanged: changed });
  }

  /**
   * Adds recipients to an existing share and emails each a link of their own.
   *
   * Per recipient, not per share — the same rule as creation. One shared URL cannot be withdrawn from
   * one person, and cannot tell the operator who actually opened it.
   */
  async addRecipients(req: any, res: Response): Promise<Response> {
    const shareId = Number(req.params.shareId);
    const share = await this.grants.findShare(shareId);
    if (!share) return res.status(404).json({ error: 'Share not found.' });

    const existing = new Set((await this.grants.listGrantsForShare(shareId)).map((grant) => grant.email));
    const recipients = (Array.isArray(req.body?.recipients) ? req.body.recipients : [])
      .map((value: unknown) => CoercionUtils.toKey(value))
      .filter((value: string) => value.includes('@') && !existing.has(value));
    if (!recipients.length) return res.status(400).json({ error: 'Add at least one new recipient.' });

    const expiresAt = req.body?.expiryDays === undefined
      ? this.resolveExpiry(this.setting(SystemConstants.META_KEY.FILE_SHARE_DEFAULT_EXPIRY_DAYS, 30))
      : this.resolveExpiry(Number(req.body.expiryDays));
    const maxDownloads = req.body?.maxDownloads === undefined
      ? this.setting(SystemConstants.META_KEY.FILE_SHARE_DEFAULT_MAX_DOWNLOADS, 0)
      : Number(req.body.maxDownloads);

    const results: Array<{ email: string; sent: boolean }> = [];
    for (const email of recipients) {
      const { rawToken } = await this.grants.createGrant({
        shareId, email, userId: null, expiresAt, maxDownloads,
        requireConfirmation: Boolean(req.body?.requireConfirmation),
        requireAccount: Boolean(req.body?.requireAccount),
      });
      results.push({ email, sent: await this.emails.sendShareLink({ email, title: share.title, message: share.message, rawToken, expiresAt, maxDownloads }) });
    }

    return res.json({ recipients: results, failedRecipients: results.filter((r) => !r.sent).map((r) => r.email) });
  }

  async revokeShare(req: any, res: Response): Promise<Response> {
    await this.grants.revokeShare(Number(req.params.shareId));
    return res.json({ success: true });
  }

  /**
   * The recipient-facing URL for a token — the FRONTEND page, not the API route, so the link in an
   * email lands on a themed page rather than an `/api/v1/...` path. Built from the framework's frontend
   * base, never a literal host.
   */
  static buildShareUrl(rawToken: string): string {
    const base = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP);
    return ApplicationUrlUtils.joinApiPath(base, `${FileSharePageSlug.PATH}/${encodeURIComponent(rawToken)}`);
  }
}
