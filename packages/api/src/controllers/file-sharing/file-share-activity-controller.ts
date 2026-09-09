import { Response } from 'express';
import { CoercionUtils, FileActivityService, FileGrantRepository } from '@fromcode119/core';

/**
 * The operator's side: compose a send, see who has opened it, withdraw it.
 *
 * The revoke routes exist here because a link an operator cannot withdraw is not really revocable.
 * One plugin shipped exactly that — a DELETE endpoint with no list route and no UI, so the token id was
 * only ever visible in the one-time create response and revocation was unreachable in practice. A list
 * and a revoke ship together or neither is real.
 */
/**
 * What happened to a share: the per-share event log and the cross-share overview.
 *
 * Split out of FileShareAdminController (421 lines) 2026-09-09. Needs only the repository (and the
 * activity service), never the mailer or the plugin manager, so it is a plain class routed by FilesRouter.
 */
export class FileShareActivityController {
  constructor(
    private readonly activity: FileActivityService,
    private readonly grants: FileGrantRepository,
  ) {}

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
}
