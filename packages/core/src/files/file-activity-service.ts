import { SystemConstants } from '@core/constants/system.constants';
import { GrantOutcome } from '@core/security/enums/grant-outcome.enum';
import { FileActivityRepository } from '@core/files/file-activity-repository';
import { FileAccessKind } from '@core/files/enums/file-access-kind.enum';

/**
 * The activity screen's answers, assembled from the access log.
 *
 * The one rule shaping this: a log row records an OUTCOME, not an intention, so `granted` alone cannot
 * tell an opened page from a downloaded file. `media_id` can — it is null for a page view and carries
 * the file's id for a download — and every number here is derived from that distinction.
 *
 * Aggregation is SQL. Every total, bucket and top-list is a COUNT/GROUP BY the database computes, so
 * the numbers are exact at any volume and the application never pages rows into memory to add them up.
 * Two earlier designs did — first a capped scan whose totals went quietly wrong past 5000 events, then
 * a chunked walk with a runaway ceiling. `groupCount` on the database manager is what made those
 * unnecessary; this class is now the reason that primitive exists.
 *
 * Nothing is invented. A recipient with no opens reports no opens; a file nobody fetched does not
 * appear. An empty range renders an empty screen rather than a plausible-looking one.
 */
export class FileActivityService {
  private readonly activity: FileActivityRepository;

  constructor(private readonly db: any) {
    this.activity = new FileActivityRepository(db);
  }

  /**
   * `shareId` narrows everything to ONE send — the same screen, scoped. When set, the share itself is
   * loaded by id rather than by creation range: a share older than the window is still the subject.
   *
   * The range is either the last `days`, or an explicit `from`/`to` window when both parse. A custom
   * window is capped at a year of daily buckets — beyond that the labels stop being a chart.
   */
  async build(options: { days?: number; from?: string; to?: string; shareId?: number | null }): Promise<Record<string, unknown>> {
    const range = FileActivityService.resolveRange(options);
    const shareId = options.shareId ?? null;

    const [aggregate, shares, grants] = await Promise.all([
      this.aggregateWindow(range, shareId),
      shareId !== null ? this.shareById(shareId) : this.activity.listShares(range.since),
      this.activity.listGrants(shareId),
    ]);

    const grantsById = new Map(grants.map((grant) => [Number(grant.id), grant]));
    const shareTitles = await this.shareTitles(aggregate.firstEvents, shares);
    const mediaNames = await this.mediaNames([...aggregate.downloadCounts.keys(), ...aggregate.firstEventMediaIds]);

    return {
      range: { from: range.fromDay, to: range.toDay, days: range.days },
      shareId,
      shareTitle: shareId !== null ? (shareTitles.get(shareId) ?? '') : '',
      series: {
        labels: [...aggregate.byDay.keys()],
        views: [...aggregate.byDay.values()].map((bucket) => bucket.views),
        downloads: [...aggregate.byDay.values()].map((bucket) => bucket.downloads),
        refused: [...aggregate.byDay.values()].map((bucket) => bucket.refused),
      },
      totals: {
        sharesSent: shares.length,
        recipients: grants.filter((grant) => shares.some((share) => Number(share.id) === Number(grant.share_id ?? grant.shareId))).length,
        views: aggregate.views,
        downloads: aggregate.downloads,
        refused: aggregate.refused,
      },
      notOpened: this.notOpened(grants, shareTitles),
      topFiles: [...aggregate.downloadCounts.entries()]
        .slice(0, 10)
        .map(([mediaId, count]) => ({ mediaId, name: mediaNames.get(mediaId) ?? '', downloads: count })),
      refusals: aggregate.refusals,
      events: this.recent(aggregate.firstEvents.slice(0, FileActivityService.EVENTS_PAGE), grantsById, shareTitles, mediaNames),
      eventsHasMore: aggregate.firstEvents.length > FileActivityService.EVENTS_PAGE,
    };
  }

  /**
   * One further page of the timeline, for the Load-more control. Same window, same scope — only the
   * offset moves, so a page can never disagree with the overview it extends.
   */
  async eventsPage(options: { days?: number; from?: string; to?: string; shareId?: number | null; offset: number }): Promise<Record<string, unknown>> {
    const range = FileActivityService.resolveRange(options);
    const shareId = options.shareId ?? null;
    const offset = Math.max(0, Number(options.offset) || 0);

    const events = await this.activity.listEvents(range.since, range.until, shareId, FileActivityService.EVENTS_PAGE + 1, offset);
    const page = events.slice(0, FileActivityService.EVENTS_PAGE);

    const grants = await this.activity.listGrants(shareId);
    const grantsById = new Map(grants.map((grant) => [Number(grant.id), grant]));
    const shareTitles = await this.shareTitles(page, []);
    const mediaNames = await this.mediaNames(page.map((event) => Number(event.media_id ?? event.mediaId)).filter((id) => Number.isFinite(id) && id > 0));

    return {
      events: this.recent(page, grantsById, shareTitles, mediaNames),
      eventsHasMore: events.length > FileActivityService.EVENTS_PAGE,
    };
  }

  /**
   * The window's numbers, asked of the DATABASE: three counts, three day-bucketed group-counts, one
   * per-file group-count and one per-outcome group-count — eight aggregate queries, exact at any
   * volume. The only raw rows loaded are the timeline's first page.
   */
  private async aggregateWindow(range: { since: string; until: string | null; days: number; toDay: string }, shareId: number | null) {
    const where = (extra: Record<string, unknown>) => ({
      created_at: range.until ? { gte: range.since, lte: range.until } : { gte: range.since },
      ...(shareId !== null ? { share_id: shareId } : {}),
      ...extra,
    });
    const granted = GrantOutcome.GRANTED.value;
    const log = SystemConstants.TABLE.FILE_ACCESS_LOG;

    const [views, downloads, refused, viewDays, downloadDays, refusedDays, topDownloads, refusalRows, firstEvents] = await Promise.all([
      this.db.count(log, { where: where({ outcome: granted, media_id: null }) }),
      this.db.count(log, { where: where({ outcome: granted, media_id: { ne: null } }) }),
      this.db.count(log, { where: where({ outcome: { ne: granted } }) }),
      this.db.groupCount(log, { where: where({ outcome: granted, media_id: null }), dateBucket: { column: 'created_at' } }),
      this.db.groupCount(log, { where: where({ outcome: granted, media_id: { ne: null } }), dateBucket: { column: 'created_at' } }),
      this.db.groupCount(log, { where: where({ outcome: { ne: granted } }), dateBucket: { column: 'created_at' } }),
      this.db.groupCount(log, { where: where({ outcome: granted, media_id: { ne: null } }), groupBy: ['media_id'], limit: 10 }),
      this.db.groupCount(log, { where: where({ outcome: { ne: granted } }), groupBy: ['outcome'] }),
      this.activity.listEvents(range.since, range.until, shareId, FileActivityService.EVENTS_PAGE + 1),
    ]);

    // Every day of the window appears, including the quiet ones — a series that skips them compresses
    // time and makes one busy afternoon look like a steady week.
    const byDay = new Map<string, { views: number; downloads: number; refused: number }>();
    const dayMs = 24 * 60 * 60 * 1000;
    const end = new Date(`${range.toDay}T00:00:00Z`).getTime();
    for (let i = range.days - 1; i >= 0; i -= 1) {
      byDay.set(new Date(end - i * dayMs).toISOString().slice(0, 10), { views: 0, downloads: 0, refused: 0 });
    }
    for (const row of viewDays) { const bucket = byDay.get(String(row.day)); if (bucket) bucket.views = Number(row.count); }
    for (const row of downloadDays) { const bucket = byDay.get(String(row.day)); if (bucket) bucket.downloads = Number(row.count); }
    for (const row of refusedDays) { const bucket = byDay.get(String(row.day)); if (bucket) bucket.refused = Number(row.count); }

    return {
      byDay,
      views: Number(views),
      downloads: Number(downloads),
      refused: Number(refused),
      downloadCounts: new Map<number, number>(topDownloads.map((row) => [Number(row.media_id), Number(row.count)])),
      refusals: refusalRows.map((row) => ({ outcome: String(row.outcome ?? ''), count: Number(row.count) })),
      firstEvents,
      firstEventMediaIds: firstEvents
        .slice(0, FileActivityService.EVENTS_PAGE)
        .map((event) => Number(event.media_id ?? event.mediaId))
        .filter((id) => Number.isFinite(id) && id > 0),
    };
  }

  /** The window the caller asked for, resolved once so every query and bucket agrees on it. */
  private static resolveRange(options: { days?: number; from?: string; to?: string }): { since: string; until: string | null; days: number; fromDay: string; toDay: string } {
    const dayMs = 24 * 60 * 60 * 1000;
    const from = FileActivityService.parseDay(options.from);
    const to = FileActivityService.parseDay(options.to);

    if (from && to && to.getTime() >= from.getTime()) {
      const days = Math.min(366, Math.round((to.getTime() - from.getTime()) / dayMs) + 1);
      const until = new Date(from.getTime() + (days - 1) * dayMs + dayMs - 1000);
      return {
        since: FileActivityRepository.toLogTimestamp(from),
        until: FileActivityRepository.toLogTimestamp(until),
        days,
        fromDay: from.toISOString().slice(0, 10),
        toDay: until.toISOString().slice(0, 10),
      };
    }

    const days = Number(options.days) > 0 ? Math.min(366, Number(options.days)) : 30;
    return {
      since: FileActivityRepository.since(days),
      until: null,
      days,
      fromDay: new Date(Date.now() - (days - 1) * dayMs).toISOString().slice(0, 10),
      toDay: new Date().toISOString().slice(0, 10),
    };
  }

  /** A `YYYY-MM-DD` at UTC midnight, or null — a half-parsed date must not become a silent window. */
  private static parseDay(value: unknown): Date | null {
    const raw = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const date = new Date(`${raw}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * Recipients who have never opened anything — the only block here that is about what to DO next.
   *
   * Revoked grants are excluded: an operator who withdrew a link is not waiting on that person. Not
   * bounded by the range either, because "sent three months ago and still never opened" is exactly the
   * case worth surfacing.
   */
  private notOpened(grants: Array<Record<string, unknown>>, shareTitles: Map<number, string>): Array<Record<string, unknown>> {
    return grants
      .filter((grant) => !grant.revoked_at && !grant.revokedAt && !grant.last_access_at && !grant.lastAccessAt)
      .slice(0, 50)
      .map((grant) => ({
        email: String(grant.email || ''),
        shareId: Number(grant.share_id ?? grant.shareId),
        shareTitle: shareTitles.get(Number(grant.share_id ?? grant.shareId)) ?? '',
        sentAt: grant.created_at ?? grant.createdAt ?? null,
        expiresAt: grant.expires_at ?? grant.expiresAt ?? null,
      }));
  }

  /** The timeline, said in words: who, what they did, to which file, and when. */
  private recent(
    events: Array<Record<string, unknown>>,
    grantsById: Map<number, Record<string, unknown>>,
    shareTitles: Map<number, string>,
    mediaNames: Map<number, string>,
  ): Array<Record<string, unknown>> {
    return events.map((event) => {
      const grant = grantsById.get(Number(event.grant_id ?? event.grantId));
      const shareId = Number(event.share_id ?? event.shareId ?? grant?.share_id ?? grant?.shareId ?? 0);
      const mediaId = Number(event.media_id ?? event.mediaId);

      return {
        id: Number(event.id),
        email: String(grant?.email || ''),
        shareId: shareId || null,
        shareTitle: shareTitles.get(shareId) ?? '',
        kind: FileAccessKind.of(event).value,
        fileName: Number.isFinite(mediaId) ? (mediaNames.get(mediaId) ?? '') : '',
        outcome: String(event.outcome || ''),
        at: event.created_at ?? event.createdAt ?? null,
      };
    });
  }

  /** The one share a scoped build is about; absent shares resolve to an empty list, not an invented row. */
  private async shareById(shareId: number): Promise<Array<Record<string, unknown>>> {
    const row = await this.db.findOne(SystemConstants.TABLE.FILE_SHARES, { id: shareId });
    return row ? [row] : [];
  }

  /** Titles for every share the SHOWN rows reference — names are resolved for the page, not the scan. */
  private async shareTitles(events: Array<Record<string, unknown>>, shares: Array<Record<string, unknown>>): Promise<Map<number, string>> {
    const titles = new Map<number, string>(shares.map((share) => [Number(share.id), String(share.title || '')]));

    for (const event of events.slice(0, FileActivityService.EVENTS_PAGE)) {
      const shareId = Number(event.share_id ?? event.shareId);
      if (!Number.isFinite(shareId) || shareId <= 0 || titles.has(shareId)) continue;
      const row = await this.db.findOne(SystemConstants.TABLE.FILE_SHARES, { id: shareId });
      titles.set(shareId, row ? String(row.title || '') : '');
    }

    return titles;
  }

  /** File names by id. A deleted file resolves to nothing, not a fake name. */
  private async mediaNames(mediaIds: Iterable<number>): Promise<Map<number, string>> {
    const names = new Map<number, string>();

    for (const mediaId of mediaIds) {
      if (!Number.isFinite(mediaId) || mediaId <= 0 || names.has(mediaId)) continue;
      const row = await this.db.findOne(SystemConstants.TABLE.MEDIA, { id: mediaId });
      names.set(mediaId, row ? String(row.original_name || row.originalName || row.filename || '') : '');
    }

    return names;
  }

  /** How much timeline one response carries; the rest arrives by offset. */
  private static readonly EVENTS_PAGE = 50;

}
