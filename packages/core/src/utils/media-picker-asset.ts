import { SystemConstants } from '@core/constants/system.constants';
import { ApiPathUtils } from '@core/api';
import { PublicAssetUrlUtils } from '@core/utils/public-asset-url-utils';
import { MediaVisibility } from '@core/enums/media-visibility.enum';

/**
 * What a site-setting media picker (Settings → General: the email logo, the site icon) points at,
 * as a path on the site's host — or `''` when it points at nothing that can be served.
 *
 * The setting holds what the picker hands back: an uploaded file's id, or a file shipped in the active
 * theme as `theme:<path under ui/>` — the picker offers both in one popup. A file that is gone or
 * private resolves to `''`, so a caller shows nothing rather than a broken image.
 */
export class MediaPickerAsset {
  /** The media picker's id for a theme asset: `theme:` plus its path under the theme's `ui/`. */
  static readonly THEME_PREFIX = 'theme:';

  static async sitePath(
    db: { findOne(table: string, where: Record<string, unknown>): Promise<any> },
    settingValue: unknown,
    activeThemeSlug: () => Promise<string | null>,
  ): Promise<string> {
    const value = String(settingValue ?? '').trim();
    if (value.startsWith(MediaPickerAsset.THEME_PREFIX)) {
      return MediaPickerAsset.themeAssetPath(value.slice(MediaPickerAsset.THEME_PREFIX.length), activeThemeSlug);
    }
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return '';

    const media = await db.findOne(SystemConstants.TABLE.MEDIA, { id });
    if (!media || MediaVisibility.resolve(media.visibility).isPrivate) return '';
    const file = String(media.path || media.filename || '').trim();
    return file ? PublicAssetUrlUtils.resolveMediaUrl(file, '') : '';
  }

  /** A file in the site's ACTIVE theme — the one the picker listed it from. */
  private static async themeAssetPath(relativePath: string, activeThemeSlug: () => Promise<string | null>): Promise<string> {
    const path = relativePath.replace(/^\/+/, '');
    if (!path || path.split('/').includes('..')) return '';
    const slug = String((await activeThemeSlug()) || '').trim();
    return slug ? ApiPathUtils.themeUiAssetPath(slug, path) : '';
  }
}
