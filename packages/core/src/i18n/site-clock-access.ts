import type { ISiteClock } from '@core/i18n/interfaces/site-clock.interface';
import type { ISiteClockSettings } from '@core/i18n/interfaces/site-clock-settings.interface';
import { TimeFormatUtils } from '@core/utils/time-format-utils';

/**
 * A site's clock — timezone and 12/24-hour — for code that writes times OUTSIDE the admin: a booking
 * email, a document. The admin already formats with the site's clock; a plugin had no way to ask, so an
 * appointment email wrote its time in the server's zone (UTC) instead of the site's.
 *
 * The api configures the reader at boot (the settings live in `_system_meta`, which only the framework
 * reads). Each call reads the site's own values over the platform's, so a saved change applies at once.
 */
export class SiteClockAccess {
  private static reader: ((tenantId: string) => Promise<ISiteClockSettings>) | undefined;

  static configure(reader: (tenantId: string) => Promise<ISiteClockSettings>): void {
    SiteClockAccess.reader = reader;
  }

  /** The clock of `tenantId` (or the platform's when no site is bound). UTC and 24-hour when unconfigured. */
  static async read(tenantId: string | undefined | null): Promise<ISiteClock> {
    const settings = SiteClockAccess.reader ? await SiteClockAccess.reader(String(tenantId || '')) : {};
    return SiteClockAccess.from(settings);
  }

  static from(settings: ISiteClockSettings): ISiteClock {
    const timeZone = String(settings.timezone || '').trim() || 'UTC';
    return { timeZone, hourCycle: TimeFormatUtils.hourCycle(settings.timeFormat, String(settings.locale || '')) };
  }
}
