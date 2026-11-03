import { ApiPathUtils } from '@core/api';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { MediaPickerAsset } from '@core/utils/media-picker-asset';
import { SiteBaseUrl } from '@core/tenant/site-base-url';

/**
 * The absolute address of the site's email logo (Settings → General → Email logo), or `''`.
 *
 * On the SITE's own host, never the platform's: a site's uploads live in its own directory and are
 * served per host, and a mail app fetches the image long after the send. Empty when no logo is
 * picked, the file is gone or private, or the site has no frontend address — an email then shows no
 * logo rather than a broken image or a guessed one. What the setting may hold: `MediaPickerAsset`.
 */
export class EmailLogoUrl {
  static async resolve(
    db: { findOne(table: string, where: Record<string, unknown>): Promise<any> },
    settingValue: unknown,
    activeThemeSlug: () => Promise<string | null>,
  ): Promise<string> {
    const path = await MediaPickerAsset.sitePath(db, settingValue, activeThemeSlug);
    if (!path) return '';
    const base = await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP);
    if (!base) return '';
    return /^https?:\/\//i.test(path) ? path : ApiPathUtils.absoluteUrl(base, path);
  }
}
