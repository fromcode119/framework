import { FrameworkTranslations } from '@react/i18n/framework-translations';
import EN from '@react/storefront-notice/i18n/en.json';
import BG from '@react/storefront-notice/i18n/bg.json';

/** The notice bar's own words (its close button). Registered once, when the module is evaluated. */
export class StorefrontNoticeTranslations {
  private static registered = false;

  static register(): boolean {
    if (StorefrontNoticeTranslations.registered) return true;
    FrameworkTranslations.registerAll({ en: EN as any, bg: BG as any }); // eslint-disable-line @typescript-eslint/no-explicit-any
    StorefrontNoticeTranslations.registered = true;
    return true;
  }
}
