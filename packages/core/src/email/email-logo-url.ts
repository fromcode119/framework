import { SystemConstants } from '@core/constants/system.constants';
import { ApiPathUtils } from '@core/api';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { PublicAssetUrlUtils } from '@core/utils/public-asset-url-utils';
import { MediaVisibility } from '@core/enums/media-visibility.enum';
import { SiteBaseUrl } from '@core/tenant/site-base-url';

/**
 * The absolute address of the site's email logo (Settings → General → Email logo), or `''`.
 *
 * On the SITE's own host, never the platform's: a site's uploads live in its own directory and are
 * served per host, and a mail app fetches the image long after the send. Empty when no logo is
 * picked, the file is gone or private, or the site has no frontend address — an email then shows no
 * logo rather than a broken image or a guessed one.
 *
 * The setting holds what the media picker hands back: an uploaded file's id, or a file shipped in the
 * active theme as `theme:<path under ui/>` — the picker offers both in one popup, and a theme's own
 * logo is the natural pick.
 */
export class EmailLogoUrl {
  /** The media picker's id for a theme asset: `theme:` plus its path under the theme's `ui/`. */
  static readonly THEME_PREFIX = 'theme:';

  static async resolve(
    db: { findOne(table: string, where: Record<string, unknown>): Promise<any> },
    settingValue: unknown,
    activeThemeSlug: () => Promise<string | null>,
  ): Promise<string> {
    const value = String(settingValue ?? '').trim();
    if (value.startsWith(EmailLogoUrl.THEME_PREFIX)) {
      return EmailLogoUrl.themeAsset(value.slice(EmailLogoUrl.THEME_PREFIX.length), activeThemeSlug);
    }
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return '';

    const media = await db.findOne(SystemConstants.TABLE.MEDIA, { id });
    if (!media || MediaVisibility.resolve(media.visibility).isPrivate) return '';
    const file = String(media.path || media.filename || '').trim();
    if (!file) return '';

    const base = await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP);
    if (!base) return '';
    return PublicAssetUrlUtils.resolveMediaUrl(file, base);
  }

  /** A file in the site's ACTIVE theme — the one the picker listed it from — on the site's host. */
  private static async themeAsset(relativePath: string, activeThemeSlug: () => Promise<string | null>): Promise<string> {
    const path = relativePath.replace(/^\/+/, '');
    if (!path || path.split('/').includes('..')) return '';
    const slug = String((await activeThemeSlug()) || '').trim();
    if (!slug) return '';
    const base = await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP);
    if (!base) return '';
    return ApiPathUtils.absoluteUrl(base, ApiPathUtils.themeUiAssetPath(slug, path));
  }
}
