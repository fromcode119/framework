import { CoercionUtils } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * "in 3m", "2h ago", "now" — the form a dashboard row needs, where the exact timestamp is noise and
 * the distance is the point.
 *
 * An unparsable or absent value returns "not scheduled yet" rather than an epoch date: a scheduler
 * task the pulse has never touched genuinely has no next run, and 1 Jan 1970 would be a lie with a
 * very confident face.
 *
 * Worded by `Intl.RelativeTimeFormat` in the console's language, so every language gets its own
 * plurals and word order ("преди 2 ч.") instead of English built by hand.
 */
export class RelativeTimeFormatter {
  private static readonly MINUTE = 60_000;
  private static readonly HOUR = 60 * RelativeTimeFormatter.MINUTE;
  private static readonly DAY = 24 * RelativeTimeFormatter.HOUR;

  static fromNow(value: unknown, absent = AdminI18n.t('common.notScheduledYet')): string {
    const raw = CoercionUtils.toString(value).trim();
    if (!raw) return absent;
    const at = new Date(raw).getTime();
    if (!Number.isFinite(at)) return absent;

    const delta = at - Date.now();
    const format = new Intl.RelativeTimeFormat(AdminI18n.locale, { numeric: 'auto', style: 'narrow' });
    const magnitude = Math.abs(delta);
    if (magnitude < RelativeTimeFormatter.MINUTE) return format.format(0, 'second');

    const sign = delta > 0 ? 1 : -1;
    if (magnitude < RelativeTimeFormatter.HOUR) return format.format(sign * Math.round(magnitude / RelativeTimeFormatter.MINUTE), 'minute');
    if (magnitude < RelativeTimeFormatter.DAY) return format.format(sign * Math.round(magnitude / RelativeTimeFormatter.HOUR), 'hour');
    return format.format(sign * Math.round(magnitude / RelativeTimeFormatter.DAY), 'day');
  }
}
