import fs from 'fs';
import path from 'path';
import { ApiPathUtils } from '@core/api';
import { SystemConstants } from '@core/constants/system.constants';
import { SiteIconSource } from '@core/enums/site-icon-source.enum';
import { MediaPickerAsset } from '@core/utils/media-picker-asset';
import { SiteIconChoice } from '@core/theme/site-icon/site-icon-choice';
import { SiteIcon } from '@core/theme/site-icon/site-icon';

/**
 * Which file a site serves as its icon, in this order:
 *
 *   1. the file picked in Settings → General → Site icon (`site_icon`) — used for both icons;
 *   2. the first of the active theme's own icon files that exists in its `ui/`;
 *   3. nothing — the storefront serves the platform's mark (`SiteIconSource.PLATFORM`).
 *
 * Decided on the api, which can see the theme's files, so the storefront fetches one known path and
 * the admin can say exactly which file is live when the setting is empty.
 */
export class SiteIconResolver {
  static readonly FAVICON_FILES = ['favicon.ico', 'favicon.png', 'favicon.svg', 'favicon-32x32.png', 'favicon-16x16.png'];
  static readonly APPLE_TOUCH_ICON_FILES = ['apple-touch-icon.png', 'apple-touch-icon-180x180.png', 'apple-touch-icon-precomposed.png'];

  static async resolve(
    db: { findOne(table: string, where: Record<string, unknown>): Promise<any> },
    theme: { slug: string; uiDirectory: string } | null,
  ): Promise<SiteIcon> {
    const row = await db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.SITE_ICON });
    const picked = await MediaPickerAsset.sitePath(db, row?.value, async () => theme?.slug ?? null);
    const themeFavicon = SiteIconResolver.themeFile(theme, SiteIconResolver.FAVICON_FILES);
    if (picked) {
      const choice = new SiteIconChoice(SiteIconSource.SETTING, picked, '');
      return new SiteIcon(choice, choice, themeFavicon);
    }
    return new SiteIcon(themeFavicon, SiteIconResolver.themeFile(theme, SiteIconResolver.APPLE_TOUCH_ICON_FILES), themeFavicon);
  }

  private static themeFile(theme: { slug: string; uiDirectory: string } | null, files: string[]): SiteIconChoice {
    if (!theme?.slug) return SiteIconChoice.PLATFORM;
    const file = files.find((name) => fs.existsSync(path.join(theme.uiDirectory, name)));
    return file
      ? new SiteIconChoice(SiteIconSource.THEME, ApiPathUtils.themeUiAssetPath(theme.slug, file), file)
      : SiteIconChoice.PLATFORM;
  }
}
