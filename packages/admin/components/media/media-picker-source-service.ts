import type { IMediaItem } from '@/components/media/interfaces/media-item.interface';
import { CoercionUtils } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * The second source behind the media picker: the images and videos that ship INSIDE the active
 * theme, listed by the framework's theme-assets endpoint.
 *
 * They are shown next to uploads rather than behind a separate button, because from the operator's
 * seat "pick a picture" is one job — which directory the file happens to live in is our concern,
 * not theirs. The distinction survives in the data (`relativePath` is set only here), so a field can
 * still say where a value came from.
 */
export class MediaPickerSourceService {
  /** Keeps a theme asset id from ever colliding with a media record id. */
  private static readonly THEME_ID_PREFIX = 'theme:';

  static async fetchThemeAssets(): Promise<IMediaItem[]> {
    const payload = await AdminApi.get(AdminConstants.ENDPOINTS.THEMES.ACTIVE_ASSETS);
    const assets: unknown[] = Array.isArray(payload?.assets) ? payload.assets : [];
    const items: IMediaItem[] = [];
    for (const asset of assets) {
      const item = MediaPickerSourceService.toMediaItem(asset);
      if (item) items.push(item);
    }
    return items;
  }

  /**
   * True when `value` is the very asset `item` describes. Compared as normalised paths so the same
   * file matches whether it was stored relative (`images/hero.jpg`) or absolute — no guessing, just
   * equality after the origin is stripped.
   */
  static matches(item: IMediaItem, value: string): boolean {
    const target = MediaPickerSourceService.pathOf(value);
    if (!target) return false;
    if (target === MediaPickerSourceService.pathOf(item.url)) return true;
    return !!item.relativePath && target === MediaPickerSourceService.pathOf(item.relativePath);
  }

  /**
   * The item a stored value points at — theme assets first, then uploads — or null when neither
   * source holds it. Null is a real answer: the uploads page the picker fetched is capped, so a
   * value can be genuine and simply not on it, and marking some other tile would be a lie.
   */
  static resolveSelection(value: string, themeAssets: IMediaItem[], uploads: IMediaItem[]): IMediaItem | null {
    if (!CoercionUtils.toString(value)) return null;
    const inTheme = themeAssets.find((item) => MediaPickerSourceService.matches(item, value));
    if (inTheme) return inTheme;
    return uploads.find((item) => MediaPickerSourceService.matches(item, value)) || null;
  }

  /** Filename/path substring match, so the picker's search box works on the theme tab too. */
  static search(items: IMediaItem[], query: string): IMediaItem[] {
    const needle = CoercionUtils.toString(query).toLowerCase();
    if (!needle) return items;
    return items.filter((item) => (
      item.filename.toLowerCase().includes(needle) ||
      CoercionUtils.toString(item.relativePath).toLowerCase().includes(needle)
    ));
  }

  private static toMediaItem(asset: unknown): IMediaItem | null {
    const record = asset as Record<string, unknown> | null;
    const relativePath = CoercionUtils.toString(record?.relativePath);
    const url = CoercionUtils.toString(record?.url);
    const mimeType = CoercionUtils.toString(record?.mimeType);
    if (!relativePath || !url || !mimeType) return null;

    return {
      id: `${MediaPickerSourceService.THEME_ID_PREFIX}${relativePath}`,
      filename: CoercionUtils.toString(record?.filename) || relativePath,
      url,
      mimeType,
      relativePath,
    };
  }

  private static pathOf(value: string): string {
    const raw = CoercionUtils.toString(value);
    if (!raw) return '';
    const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/i, '');
    return withoutOrigin.startsWith('/') ? withoutOrigin : `/${withoutOrigin}`;
  }
}
