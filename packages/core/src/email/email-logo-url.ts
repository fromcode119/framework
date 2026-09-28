import { SystemConstants } from '@core/constants/system.constants';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { PublicAssetUrlUtils } from '@core/utils/public-asset-url-utils';
import { MediaVisibility } from '@core/enums/media-visibility.enum';
import { SiteBaseUrl } from '@core/tenant/site-base-url';

/**
 * The absolute address of the site's email logo (Settings → General → Email logo), or `''`.
 *
 * On the SITE's own host, never the platform's: a site's uploads live in its own directory and are
 * served per host, and a mail app fetches the image long after the send, from outside the platform.
 * Empty when no logo is picked, the media record is gone or private, or the site has no frontend
 * address — an email then shows no logo rather than a broken image or a guessed one.
 */
export class EmailLogoUrl {
  static async resolve(db: { findOne(table: string, where: Record<string, unknown>): Promise<any> }, settingValue: unknown): Promise<string> {
    const id = Number(String(settingValue ?? '').trim());
    if (!Number.isInteger(id) || id <= 0) return '';

    const media = await db.findOne(SystemConstants.TABLE.MEDIA, { id });
    if (!media || MediaVisibility.resolve(media.visibility).isPrivate) return '';
    const file = String(media.path || media.filename || '').trim();
    if (!file) return '';

    const base = await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP);
    if (!base) return '';
    return PublicAssetUrlUtils.resolveMediaUrl(file, base);
  }
}
