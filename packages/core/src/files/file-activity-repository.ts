import { SystemConstants } from '@core/constants/system.constants';

/**
 * Reads the access log across ALL shares, for the activity screen.
 *
 * Separate from `FileGrantRepository`, which answers questions about one share. The questions here run
 * the other way — "what happened this month", "who has never opened anything" — and are bounded by a
 * date range rather than by a grant.
 *
 * Every range is expressed in the log's OWN timestamp format. `created_at` is written by the database
 * default as `YYYY-MM-DD HH:MM:SS`, and an ISO string compared against it sorts wrong ('T' > ' '), so a
 * "last 30 days" filter would quietly match rows outside the range. That has bitten this codebase
 * before; the formatting below is the reason it does not here.
 */
export class FileActivityRepository {
  constructor(private readonly db: any) {}

  /** The database's own timestamp shape, in UTC — never an ISO string. See the class note. */
  static toLogTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }

  static since(days: number): string {
    const span = Number.isFinite(days) && days > 0 ? days : 30;
    return FileActivityRepository.toLogTimestamp(new Date(Date.now() - span * 24 * 60 * 60 * 1000));
  }

  /** How many events a single aggregate scan will read before admitting truncation. */
  static readonly SCAN_LIMIT = 5000;

  /**
   * Raw log rows in the range, newest first. Scoped to one share when the caller asks about one, and
   * bounded above when the caller gives an end date — a custom range is a window, not just a start.
   */
  async listEvents(
    sinceStamp: string,
    untilStamp: string | null = null,
    shareId: number | null = null,
    limit = FileActivityRepository.SCAN_LIMIT,
    offset = 0,
  ): Promise<Array<Record<string, unknown>>> {
    const created: Record<string, string> = { gte: sinceStamp };
    if (untilStamp) created.lte = untilStamp;

    const where: Record<string, unknown> = { created_at: created };
    if (shareId !== null) where.share_id = shareId;

    const rows = await this.db.find(SystemConstants.TABLE.FILE_ACCESS_LOG, {
      where,
      orderBy: { id: 'desc' },
      limit,
      offset,
    });
    return Array.isArray(rows) ? rows : [];
  }

  /** Shares created in the range — the denominator for "how much did we send". */
  async listShares(sinceStamp: string, limit = 500): Promise<Array<Record<string, unknown>>> {
    const rows = await this.db.find(SystemConstants.TABLE.FILE_SHARES, {
      where: { created_at: { gte: sinceStamp } },
      orderBy: { id: 'desc' },
      limit,
    });
    return Array.isArray(rows) ? rows : [];
  }

  /** Every grant, so the screen can name recipients and find the ones who never opened. */
  async listGrants(shareId: number | null = null, limit = 2000): Promise<Array<Record<string, unknown>>> {
    const rows = await this.db.find(SystemConstants.TABLE.FILE_GRANTS, {
      ...(shareId !== null ? { where: { share_id: shareId } } : {}),
      orderBy: { id: 'desc' },
      limit,
    });
    return Array.isArray(rows) ? rows : [];
  }
}
