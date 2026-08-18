import { Response } from 'express';
import { BaseController, PluginManager, Logger, GrantOutcome, FileGrantRepository, FileShareAccessService, MediaVisibility, SystemConstants } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';
import { FileShareRateLimiter } from '@api/services/file-share-rate-limiter';

/**
 * Recipient-facing delivery of privately stored files, plus the operator's side of it.
 *
 * The rule the whole class is built around: a caller who is not entitled learns NOTHING. Every refusal
 * returns the same body and the same status, whether the token never existed, expired last month, was
 * revoked this morning, or has been downloaded too many times. Those distinctions are recorded in the
 * access log for the operator; telling the visitor which one applied confirms the link once existed and
 * — if file names came with it — what it held.
 */
export class FilesController extends BaseController {
  private readonly logger = new Logger({ namespace: 'files-controller' });
  private readonly db: any;
  private readonly grants: FileGrantRepository;
  private readonly access: FileShareAccessService;

  constructor(private manager: PluginManager, private mediaManager: MediaManager, private settingsCache: Map<string, string>) {
    super();
    this.db = (manager as any).db;
    this.grants = new FileGrantRepository(this.db);
    this.access = new FileShareAccessService(this.db, this.grants);
  }

  /** One body for every refusal. Deliberately says nothing about which condition failed. */
  private refuse(res: Response): Response {
    return res.status(404).json({ error: 'This link is no longer available.' });
  }

  private clientIp(req: any): string {
    return String(req.ip || req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  }

  /** The address of the signed-in user, from the SESSION only — never from the request body. */
  private signedInEmail(req: any): string | null {
    const email = String(req.user?.email || '').trim().toLowerCase();
    return email || null;
  }

  private rateLimit(): number {
    return Number(this.settingsCache.get(SystemConstants.META_KEY.FILE_SHARE_RATE_LIMIT_PER_MINUTE) || 30);
  }

  /**
   * The landing page's data: what this token opens.
   *
   * Public by design — most recipients have no account, and the token is the credential. An address in
   * the query or body is never consulted, so this cannot be aimed at a stranger.
   */
  async resolve(req: any, res: Response): Promise<Response | void> {
    const ip = this.clientIp(req);
    if (FileShareRateLimiter.isLimited(ip, this.rateLimit())) {
      return res.status(429).json({ error: 'Too many requests.' });
    }
    FileShareRateLimiter.record(ip);

    const resolution = await this.access.resolveForView(String(req.params.token || ''), this.signedInEmail(req));

    await this.grants.logAccess({
      grantId: resolution.grant?.id ?? null,
      shareId: resolution.grant?.shareId ?? null,
      mediaId: null,
      outcome: resolution.outcome,
      ip,
      userAgent: String(req.headers?.['user-agent'] || ''),
    });

    // The two recoverable refusals are the only ones that say anything, because the visitor can act on
    // them. Everything else is indistinguishable.
    if (resolution.outcome === GrantOutcome.ACCOUNT_REQUIRED) {
      return res.status(401).json({ error: 'Sign in to open this.', reason: GrantOutcome.ACCOUNT_REQUIRED.value });
    }
    if (resolution.outcome === GrantOutcome.CONFIRMATION_REQUIRED) {
      return res.status(401).json({ error: 'Confirm your email address to open this.', reason: GrantOutcome.CONFIRMATION_REQUIRED.value });
    }
    if (!resolution.outcome.isGranted || !resolution.share) return this.refuse(res);

    return res.json({
      title: resolution.share.title,
      message: resolution.share.message,
      // Name and size only. No path, no storage URL, no media id beyond what the download link needs.
      files: resolution.files.map((file) => ({ id: file.id, name: file.name, size: file.size })),
      downloadsRemaining: resolution.grant && resolution.grant.maxDownloads > 0
        ? Math.max(0, resolution.grant.maxDownloads - resolution.grant.downloadCount)
        : null,
    });
  }

  /**
   * Everything shared with the signed-in user, for the account area.
   *
   * Matched on the SESSION address, never a query parameter — otherwise this endpoint would hand any
   * authenticated user everything sent to any address they can name. Revoked and expired grants are
   * omitted rather than shown greyed out: the account area is not an audit log, and listing a dead
   * grant tells the holder a file existed without letting them open it.
   */
  async listMine(req: any, res: Response): Promise<Response> {
    const email = this.signedInEmail(req);
    if (!email) return res.status(401).json({ error: 'Not signed in.' });

    const grants = await this.grants.listGrantsForEmail(email);
    const shares: Array<{ id: number; title: string; files: Array<{ id: number; name: string; size: number }>; downloadsRemaining: number | null }> = [];

    for (const grant of grants) {
      if (FileShareAccessService.evaluateGrant(grant) !== GrantOutcome.GRANTED) continue;

      const share = await this.grants.findShare(grant.shareId);
      if (!share) continue;

      shares.push({
        id: share.id,
        title: share.title,
        files: await this.filesForShare(share.mediaIds),
        downloadsRemaining: grant.maxDownloads > 0 ? Math.max(0, grant.maxDownloads - grant.downloadCount) : null,
      });
    }

    return res.json({ data: shares });
  }

  /**
   * The same download, reached from the account area instead of an emailed link.
   *
   * A signed-in recipient holds no token — it went out in the email and is not recoverable — so the
   * SESSION address is the credential here. Without this route the account panel would list file names
   * with no way to open them, which is a control that does not do what it implies.
   *
   * Entitlement is re-derived from the session on every request; it is never trusted from the URL.
   */
  async downloadMine(req: any, res: Response): Promise<Response | void> {
    const email = this.signedInEmail(req);
    if (!email) return res.status(401).json({ error: 'Not signed in.' });

    const shareId = Number(req.params.shareId);
    const mediaId = Number(req.params.mediaId);
    const ip = this.clientIp(req);

    const grant = (await this.grants.listGrantsForEmail(email))
      .find((candidate) => candidate.shareId === shareId && FileShareAccessService.evaluateGrant(candidate).isGranted);

    if (!grant) return this.refuse(res);

    const share = await this.grants.findShare(shareId);
    if (!share || !share.mediaIds.includes(mediaId)) return this.refuse(res);

    const row = await this.db.findOne(SystemConstants.TABLE.MEDIA, { id: mediaId });
    if (!row) return this.refuse(res);

    // Counted before serving, exactly as the token path is — the cap must not depend on which door
    // the recipient came through.
    const counted = await this.access.countDownload(grant, ip);
    if (!counted) {
      await this.grants.logAccess({ grantId: grant.id, shareId: grant.shareId, mediaId, outcome: GrantOutcome.OVER_LIMIT, ip, userAgent: String(req.headers?.['user-agent'] || '') });
      return this.refuse(res);
    }

    await this.grants.logAccess({ grantId: grant.id, shareId: grant.shareId, mediaId, outcome: GrantOutcome.GRANTED, ip, userAgent: String(req.headers?.['user-agent'] || '') });

    return this.streamFile(res, {
      id: Number(row.id),
      name: String(row.original_name || row.originalName || row.filename || ''),
      path: String(row.path || ''),
      visibility: String(row.visibility || 'public'),
      mimeType: String(row.mime_type || row.mimeType || 'application/octet-stream'),
    });
  }

  /** Name and size only — the account panel needs no path and must never receive a storage URL. */
  private async filesForShare(mediaIds: number[]): Promise<Array<{ id: number; name: string; size: number }>> {
    const files: Array<{ id: number; name: string; size: number }> = [];

    for (const mediaId of mediaIds) {
      const row = await this.db.findOne(SystemConstants.TABLE.MEDIA, { id: mediaId });
      if (!row) continue;
      files.push({
        id: Number(row.id),
        name: String(row.original_name || row.originalName || row.filename || ''),
        size: Number(row.file_size ?? row.fileSize ?? 0),
      });
    }

    return files;
  }

  /**
   * Streams one file, if this token is entitled to it AND that file belongs to this share.
   *
   * The second half matters: without it a valid token would be a key to the entire media library, since
   * the media id travels in the URL beside it.
   */
  async download(req: any, res: Response): Promise<Response | void> {
    const ip = this.clientIp(req);
    if (FileShareRateLimiter.isLimited(ip, this.rateLimit())) {
      return res.status(429).json({ error: 'Too many requests.' });
    }
    FileShareRateLimiter.record(ip);

    const mediaId = Number(req.params.mediaId);
    const resolution = await this.access.resolveForDownload(String(req.params.token || ''), mediaId, this.signedInEmail(req));
    const file = resolution.files[0];

    const logAndRefuse = async (outcome: GrantOutcome) => {
      await this.grants.logAccess({ grantId: resolution.grant?.id ?? null, shareId: resolution.grant?.shareId ?? null, mediaId, outcome, ip, userAgent: String(req.headers?.['user-agent'] || '') });
      return this.refuse(res);
    };

    if (!resolution.outcome.isGranted || !file || !resolution.grant) {
      return logAndRefuse(resolution.outcome);
    }

    // Count BEFORE serving. A lost race here means another request already took the last permitted
    // download — serving anyway would let two callers past a cap of one.
    const counted = await this.access.countDownload(resolution.grant, ip);
    if (!counted) return logAndRefuse(GrantOutcome.OVER_LIMIT);

    await this.grants.logAccess({ grantId: resolution.grant.id, shareId: resolution.grant.shareId, mediaId, outcome: GrantOutcome.GRANTED, ip, userAgent: String(req.headers?.['user-agent'] || '') });

    return this.streamFile(res, file);
  }

  /**
   * Pipes the bytes. Headers go out only once the stream is open, because a driver error after
   * `writeHead` cannot be turned into a clean error response — at that point the only honest move is to
   * destroy the connection so the client sees a truncated transfer rather than a corrupt file.
   */
  private async streamFile(res: Response, file: { id: number; name: string; path: string; visibility: string; mimeType: string }): Promise<void> {
    try {
      const stream = await this.mediaManager.stream(file.path, MediaVisibility.resolve(file.visibility).value);

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
      // Never cached by a shared proxy: the URL carries a capability, and the bytes are not public.
      res.setHeader('Cache-Control', 'no-store, private');

      stream.on('error', (error: any) => {
        this.logger.error(`Stream failed for media ${file.id}: ${error?.message}`);
        res.destroy();
      });

      stream.pipe(res);
    } catch (error: any) {
      // Missing file or unconfigured space — logged with the media id, never with the token.
      this.logger.error(`Could not open media ${file.id}: ${error?.message}`);
      this.refuse(res);
    }
  }
}
