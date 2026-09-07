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
      const mediaIds = FileShareAdminController.parseMediaIds(row.media_ids ?? row.mediaIds);
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

  /**
   * Changes the terms of an ISSUED link, or adds people to a share that has already gone out.
   *
   * Without this a share was write-once: the only way to give someone another week was to send a second
   * link, leaving two live URLs where the operator believed there was one. `expiryDays` is relative to
   * NOW (what an operator means by "give them another week"); pass `expiresAt: null` for never.
   */
  async updateGrant(req: any, res: Response): Promise<Response> {
    const patch = FileShareAdminController.readGrantPatch(req.body);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change.' });

    const updated = await this.grants.updateGrant(Number(req.params.grantId), patch);
    // A revoked grant matches nothing — say so rather than reporting a success that did not happen.
    if (!updated) return res.status(409).json({ error: 'This link was revoked and cannot be changed. Issue a new one.' });
    return res.json({ success: true });
  }

  /** The same terms applied to every link in a share, plus its title and message. */
  async updateShare(req: any, res: Response): Promise<Response> {
    const shareId = Number(req.params.shareId);
    const title = req.body?.title === undefined ? undefined : CoercionUtils.toString(req.body.title);
    const message = req.body?.message === undefined ? undefined : CoercionUtils.toString(req.body.message);
    if (title !== undefined && !title) return res.status(400).json({ error: 'A title is required.' });

    await this.grants.updateShare(shareId, { title, message });

    const patch = FileShareAdminController.readGrantPatch(req.body);
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

  /**
   * What actually happened to a share.
   *
   * The access log was being written and read by nothing — a table recording every open and every
   * refusal that no screen could show, which is the same as not recording it. This is what reads it:
   * per-outcome totals so the operator can see at a glance that a link is being refused, and the recent
   * events behind those totals.
   */
  async shareActivity(req: any, res: Response): Promise<Response> {
    const grants = await this.grants.listGrantsForShare(Number(req.params.shareId));
    const byGrant = new Map(grants.map((grant) => [grant.id, grant.email]));
    const events = await this.grants.listAccessLog(grants.map((grant) => grant.id));

    // One line per PERSON, not one per request. The raw event list rendered every page refresh as its
    // own "Opened" row — twenty identical lines that answered nothing. What the operator asks per
    // share is "what has each recipient done", so that is the shape returned.
    const perRecipient = new Map<number, { email: string; views: number; downloads: number; refused: number; lastAt: unknown }>();
    for (const grant of grants) {
      perRecipient.set(grant.id, { email: grant.email, views: 0, downloads: 0, refused: 0, lastAt: grant.lastAccessAt ?? null });
    }

    let views = 0;
    let downloads = 0;
    for (const event of events) {
      const row = perRecipient.get(Number(event.grant_id ?? event.grantId));
      const isGranted = String(event.outcome ?? '') === 'granted';
      const isDownload = event.media_id !== null && event.media_id !== undefined;

      if (!isGranted) { if (row) row.refused += 1; continue; }
      if (isDownload) { downloads += 1; if (row) row.downloads += 1; }
      else { views += 1; if (row) row.views += 1; }
      if (row) {
        const at = event.created_at ?? event.createdAt ?? null;
        if (!row.lastAt || String(at) > String(row.lastAt)) row.lastAt = at;
      }
    }

    return res.json({
      data: {
        recipientCount: grants.length,
        openedCount: grants.filter((grant) => grant.lastAccessAt).length,
        viewCount: views,
        downloadCount: downloads,
        refusedCount: events.filter((event) => String(event.outcome ?? '') !== 'granted').length,
        recipients: [...perRecipient.entries()].map(([grantId, row]) => ({
          grantId,
          email: row.email,
          views: row.views,
          downloads: row.downloads,
          refused: row.refused,
          lastAt: row.lastAt,
        })),
      },
    });
  }

  /**
   * Everything that happened across EVERY share in a window — the activity screen.
   *
   * Deliberately one request: the screen asks five questions of the same rows, and five endpoints would
   * mean five scans of the same range plus five chances for the numbers on screen to disagree with each
   * other.
   */
  async activityOverview(req: any, res: Response): Promise<Response> {
    const shareId = CoercionUtils.toNumber(req.query?.share, 0);
    const options = {
      days: CoercionUtils.toNumber(req.query?.days, 30),
      from: CoercionUtils.toString(req.query?.from),
      to: CoercionUtils.toString(req.query?.to),
      shareId: shareId > 0 ? shareId : null,
    };

    // `eventsOffset` asks for one further page of the SAME window — the overview is not recomputed.
    if (req.query?.eventsOffset !== undefined) {
      return res.json({ data: await this.activity.eventsPage({ ...options, offset: CoercionUtils.toNumber(req.query.eventsOffset, 0) }) });
    }

    return res.json({ data: await this.activity.build(options) });
  }

  /**
   * The grant fields an edit may carry. Absent means "leave alone" — never "reset to the default",
   * which would silently shorten a deadline the operator had extended.
   */
  private static readGrantPatch(body: any): { expiresAt?: string | null; maxDownloads?: number; requireConfirmation?: boolean; requireAccount?: boolean } {
    const patch: { expiresAt?: string | null; maxDownloads?: number; requireConfirmation?: boolean; requireAccount?: boolean } = {};

    if (body?.expiryDays !== undefined) {
      const days = Number(body.expiryDays);
      patch.expiresAt = !Number.isFinite(days) || days <= 0 ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    } else if (body?.expiresAt !== undefined) {
      patch.expiresAt = body.expiresAt === null || body.expiresAt === '' ? null : String(body.expiresAt);
    }

    if (body?.maxDownloads !== undefined) patch.maxDownloads = Number(body.maxDownloads);
    if (body?.requireConfirmation !== undefined) patch.requireConfirmation = Boolean(body.requireConfirmation);
    if (body?.requireAccount !== undefined) patch.requireAccount = Boolean(body.requireAccount);
    return patch;
  }

  /**
   * Who holds a link and what they have done with it. The token hash is never returned — it is not
   * secret enough to be useful and not useless enough to be safe.
   */
  async listGrants(req: any, res: Response): Promise<Response> {
    const grants = await this.grants.listGrantsForShare(Number(req.params.shareId));
    return res.json({
      data: grants.map((grant) => ({
        id: grant.id,
        email: grant.email,
        expiresAt: grant.expiresAt,
        maxDownloads: grant.maxDownloads,
        downloadCount: grant.downloadCount,
        revokedAt: grant.revokedAt,
        lastAccessAt: grant.lastAccessAt,
        requireAccount: grant.requireAccount,
        requireConfirmation: grant.requireConfirmation,
      })),
    });
  }

  /**
   * Every grant that currently gives access to ONE file, across all the shares it appears in.
   *
   * Sharing is done from the file in Media, so "who can open this?" is a question about a file, not
   * about a share the operator would have to remember creating. Scanning shares for the media id is
   * acceptable because `media_ids` is a JSON list and a share set is small; if that stops being true,
   * the junction table the spec deferred is the fix.
   */
  async listGrantsForMedia(req: any, res: Response): Promise<Response> {
    const mediaId = Number(req.params.mediaId);
    const shares = await this.db.find(SystemConstants.TABLE.FILE_SHARES, { orderBy: { id: 'desc' }, limit: 500 });

    const rows: any[] = [];
    for (const share of Array.isArray(shares) ? shares : []) {
      const mediaIds = FileShareAdminController.parseMediaIds(share.media_ids ?? share.mediaIds);
      if (!mediaIds.includes(mediaId)) continue;

      for (const grant of await this.grants.listGrantsForShare(Number(share.id))) {
        rows.push({
          id: grant.id,
          shareId: share.id,
          shareTitle: String(share.title || ''),
          email: grant.email,
          expiresAt: grant.expiresAt,
          maxDownloads: grant.maxDownloads,
          downloadCount: grant.downloadCount,
          revokedAt: grant.revokedAt,
          lastAccessAt: grant.lastAccessAt,
        });
      }
    }

    return res.json({ data: rows });
  }

  /** A corrupt list yields no match rather than throwing — one bad row must not break the dialog. */
  private static parseMediaIds(value: unknown): number[] {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    try {
      const parsed = JSON.parse(String(value ?? '[]'));
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  }

  async revokeGrant(req: any, res: Response): Promise<Response> {
    await this.grants.revokeGrant(Number(req.params.grantId));
    return res.json({ success: true });
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
