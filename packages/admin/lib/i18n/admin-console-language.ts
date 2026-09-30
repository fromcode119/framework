import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { LocalizationUtils } from '@fromcode119/core/client';

/**
 * The console's language is the READER's: the signed-in person's own choice (`people.preferred_locale`,
 * the field their emails already follow), else the site's Settings → Localization → "Admin default
 * locale". The api resolves it (`AdminConsoleLocale`), for the labels it translates and here.
 */
export class AdminConsoleLanguage {
  /** The reader's own choice ('' when none) and the language the console should speak to them. */
  static async current(): Promise<{ personal: string; consoleLocale: string }> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.ME_PERSON).catch(() => null);
    return {
      personal: String(response?.person?.preferredLocale ?? '').trim().toLowerCase(),
      consoleLocale: String(response?.consoleLocale ?? '').trim().toLowerCase(),
    };
  }

  /** The site's default and the languages there are to choose from, from the settings every reader gets. */
  static site(settings: Record<string, unknown> | null | undefined): { defaultLocale: string; locales: Array<{ code: string; label: string }> } {
    return {
      defaultLocale: String(settings?.admin_default_locale ?? '').trim().toLowerCase(),
      locales: LocalizationUtils.parseLocaleRegistry(settings),
    };
  }

  /**
   * Saves the reader's choice ('' returns them to the site's default) and reloads, so every label
   * follows. A refusal is handed to `onError` — the choice is kept on the reader's person, which
   * belongs to a site, so the platform scope refuses it with the reason.
   */
  static async choose(code: string, onError: (message: string) => void): Promise<void> {
    try {
      await AdminApi.patch(AdminConstants.ENDPOINTS.AUTH.ME_PERSON, { preferredLocale: code });
    } catch (err: any) {
      onError(err?.message || '');
      return;
    }
    window.location.reload();
  }
}
