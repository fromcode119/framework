import { Response } from 'express';
import { FileGrantRepository, SystemConstants } from '@fromcode119/core';

/**
 * The operator's side: compose a send, see who has opened it, withdraw it.
 *
 * The revoke routes exist here because a link an operator cannot withdraw is not really revocable.
 * One plugin shipped exactly that — a DELETE endpoint with no list route and no UI, so the token id was
 * only ever visible in the one-time create response and revocation was unreachable in practice. A list
 * and a revoke ship together or neither is real.
 */
/**
 * Per-GRANT administration: who currently holds access to a file, patching one grant, and revoking.
 *
 * Split out of FileShareAdminController (421 lines) 2026-09-09. Needs only the repository (and the
 * activity service), never the mailer or the plugin manager, so it is a plain class routed by FilesRouter.
 */
import { FileShareRequestParsers } from '@api/controllers/file-sharing/file-share-request-parsers';

export class FileGrantAdminController {
  constructor(
    private readonly db: any,
    private readonly grants: FileGrantRepository,
  ) {}





  async revokeGrant(req: any, res: Response): Promise<Response> {
    await this.grants.revokeGrant(Number(req.params.grantId));
    return res.json({ success: true });
  }

  /**
   * Changes the terms of an ISSUED link, or adds people to a share that has already gone out.
   *
   * Without this a share was write-once: the only way to give someone another week was to send a second
   * link, leaving two live URLs where the operator believed there was one. `expiryDays` is relative to
   * NOW (what an operator means by "give them another week"); pass `expiresAt: null` for never.
   */
  async updateGrant(req: any, res: Response): Promise<Response> {
    const patch = FileShareRequestParsers.readGrantPatch(req.body);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change.' });

    const updated = await this.grants.updateGrant(Number(req.params.grantId), patch);
    // A revoked grant matches nothing — say so rather than reporting a success that did not happen.
    if (!updated) return res.status(409).json({ error: 'This link was revoked and cannot be changed. Issue a new one.' });
    return res.json({ success: true });
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
      const mediaIds = FileShareRequestParsers.parseMediaIds(share.media_ids ?? share.mediaIds);
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
}
