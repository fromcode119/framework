import { CoercionUtils } from '@fromcode119/core/client';

/**
 * "in 3m", "2h ago", "now" — the form a dashboard row needs, where the exact timestamp is noise and
 * the distance is the point.
 *
 * An unparsable or absent value returns "not scheduled yet" rather than an epoch date: a scheduler
 * task the pulse has never touched genuinely has no next run, and 1 Jan 1970 would be a lie with a
 * very confident face.
 */
export class RelativeTimeFormatter {
  private static readonly MINUTE = 60_000;
  private static readonly HOUR = 60 * RelativeTimeFormatter.MINUTE;
  private static readonly DAY = 24 * RelativeTimeFormatter.HOUR;

  static fromNow(value: unknown, absent = 'not scheduled yet'): string {
    const raw = CoercionUtils.toString(value).trim();
    if (!raw) return absent;
    const at = new Date(raw).getTime();
    if (!Number.isFinite(at)) return absent;

    const delta = at - Date.now();
    const magnitude = Math.abs(delta);
    if (magnitude < RelativeTimeFormatter.MINUTE) return 'now';

    const amount = RelativeTimeFormatter.scale(magnitude);
    return delta > 0 ? `in ${amount}` : `${amount} ago`;
  }

  private static scale(magnitude: number): string {
    if (magnitude < RelativeTimeFormatter.HOUR) return `${Math.round(magnitude / RelativeTimeFormatter.MINUTE)}m`;
    if (magnitude < RelativeTimeFormatter.DAY) return `${Math.round(magnitude / RelativeTimeFormatter.HOUR)}h`;
    return `${Math.round(magnitude / RelativeTimeFormatter.DAY)}d`;
  }
}
