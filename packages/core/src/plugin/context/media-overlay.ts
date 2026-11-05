import { SystemConstants } from '@core/constants/system.constants';
import { SystemApiPaths } from '@core/constants/system-api-paths.constants';
import { ApiPathUtils } from '@core/api/api-path-utils';
import { MediaOverlayStore } from '@core/media/media-overlay-store';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import type { IMediaOverlaySpec } from '@core/media/interfaces/media-overlay-spec.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * `context.media.overlayUrls` — an extension lays its own picture (a watermark)
 * over images it serves, without touching the originals.
 *
 * The extension states the spec (from its own settings) and asks for addresses; the framework stores
 * the spec per site, makes each derived image on its first request, caches it, and drops the cache
 * when the spec changes. The original file and its media row are never written.
 */
export class MediaOverlayContext {
  /** The image types an overlay can be laid on; anything else keeps its own address. */
  static readonly IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private static readonly MAX_IDS = 500;

  constructor(private readonly manager: IPluginManagerInterface, private readonly owner: string) {}

  /**
   * The overlaid address of each image id, keyed by id. `spec` is the overlay as the extension states
   * it now; it is stored when it differs from the stored one (which drops the old cache), and null
   * switches the overlay off. An id that is not a public image of this site is absent, so the caller
   * keeps the address it already has.
   */
  async urls(ids: unknown[], spec: IMediaOverlaySpec | null): Promise<Map<string, string>> {
    const resolved = new Map<string, string>();
    const normalized = spec ? MediaOverlayContext.normalize(spec) : null;
    await new MediaOverlayStore(this.manager.db as never).write(this.owner, normalized);
    if (!normalized) return resolved;
    const unique = Array.from(new Set((ids || []).map((id) => String(id ?? '').trim()).filter((id) => /^\d+$/.test(id)))).slice(0, MediaOverlayContext.MAX_IDS);
    if (unique.length === 0) return resolved;
    const rows = await this.manager.db.find(SystemConstants.TABLE.MEDIA, { where: { id: { in: unique } }, limit: unique.length });
    const hash = MediaOverlayStore.hash(normalized);
    const from = normalized.uploadedFrom ? Date.parse(`${normalized.uploadedFrom}T00:00:00Z`) : null;
    // One address resolution for the whole batch: only the file name differs between images.
    const placeholder = 'overlay-file-placeholder';
    const template = await SiteBaseUrl.apiUrlForCurrentSite(
      ApiPathUtils.versioned(ApiPathUtils.fillPath(SystemApiPaths.ALL.MEDIA.OVERLAY, { owner: this.owner, hash, file: placeholder })),
    );
    for (const row of Array.isArray(rows) ? rows : []) {
      const visibility = String((row as any).visibility || 'public');
      const mimeType = String((row as any).mime_type ?? '');
      if (visibility !== 'public' || !MediaOverlayContext.IMAGE_TYPES.includes(mimeType)) continue;
      if (from !== null && !(new Date((row as any).created_at).getTime() >= from)) continue;
      const id = String((row as any).id);
      resolved.set(id, template.replace(placeholder, `${id}.webp`));
    }
    return resolved;
  }

  /** Whole numbers inside their ranges; the media id as a string. Out-of-range input is clamped, not refused. */
  static normalize(spec: IMediaOverlaySpec): IMediaOverlaySpec {
    const clamp = (value: unknown, min: number, max: number): number => {
      const number = Math.round(Number(value));
      return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
    };
    const overlayMediaId = String(spec.overlayMediaId ?? '').trim();
    if (!/^\d+$/.test(overlayMediaId)) throw new Error('An overlay needs the id of an image in the media library.');
    const uploadedFrom = String(spec.uploadedFrom ?? '').trim().slice(0, 10);
    return {
      overlayMediaId,
      position: String(spec.position ?? '').trim(),
      opacityPercent: clamp(spec.opacityPercent, 0, 100),
      sizePercent: clamp(spec.sizePercent, 1, 100),
      marginPercent: clamp(spec.marginPercent, 0, 50),
      ...(MediaOverlayContext.isDay(uploadedFrom) ? { uploadedFrom } : {}),
    };
  }

  private static isDay(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
  }
}
