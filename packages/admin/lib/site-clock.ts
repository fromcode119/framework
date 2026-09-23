import { Platform } from '@fromcode119/react-class-components';
import { RuntimeRegistryAccess, TimeFormatUtils } from '@fromcode119/core/client';

/**
 * The site's clock: which hour cycle its times are written in, and the language "follow the
 * language" follows. Read off the runtime bridge's settings, where the admin shell keeps the site's
 * exposed settings (Settings → General → Time format, and the site's default language).
 */
export class SiteClock {
  /** `h12` / `h23` from the site's Time format setting and default language. */
  static hourCycle(): Intl.DateTimeFormatOptions['hourCycle'] {
    return TimeFormatUtils.hourCycle(SiteClock.settings()?.time_format, SiteClock.siteLanguage());
  }

  /** The site's default language — what "follow the language" follows. */
  static siteLanguage(): string {
    const settings = SiteClock.settings();
    return String(settings?.frontend_default_locale || settings?.default_locale || '');
  }

  private static settings(): Record<string, any> | null {
    if (!Platform.isBrowser) return null;
    const bridge = (window as any)?.[RuntimeRegistryAccess.globalName]?.[RuntimeRegistryAccess.KEYS.REACT_BRIDGE];
    return bridge?.settings || bridge?.getState?.()?.settings || null;
  }
}
