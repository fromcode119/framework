import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { SystemConstants } from '@core/constants/system.constants';
import type { IMediaOverlaySpec } from '@core/media/interfaces/media-overlay-spec.interface';

/**
 * Where an extension's image overlay (a watermark) is kept, and the derived images made with it.
 *
 * The spec lives in the site's `_system_meta`, one row per extension, so the public route that serves
 * the derived images can find it without asking the extension. Derived images are cached on disk
 * under the site's own data directory, one folder per spec, keyed by the spec's hash: a changed spec
 * is a new hash, so a new address, and every cached file of the old one is removed at once.
 */
export class MediaOverlayStore {
  private static readonly META_PREFIX = 'media:overlay:';
  private static readonly CACHE_DIR = 'media-overlays';
  private static readonly SEGMENT = /^[A-Za-z0-9_-]+$/;

  constructor(private readonly db: { findOne(table: string, where: Record<string, unknown>): Promise<any>; insert(table: string, data: Record<string, unknown>): Promise<any>; update(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<any>; delete(table: string, where: Record<string, unknown>): Promise<any> }) {}

  static isSegment(value: string): boolean {
    return MediaOverlayStore.SEGMENT.test(String(value || ''));
  }

  /** A stable short hash of a spec: same spec, same address; any change, a new one. */
  static hash(spec: IMediaOverlaySpec): string {
    const canonical = JSON.stringify([spec.overlayMediaId, spec.position, spec.opacityPercent, spec.sizePercent, spec.marginPercent]);
    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  }

  async read(owner: string): Promise<IMediaOverlaySpec | null> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: MediaOverlayStore.metaKey(owner) });
    const raw = String(row?.value ?? '');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as IMediaOverlaySpec;
    } catch {
      return null;
    }
  }

  /** Store (or with null, clear) an extension's spec; a change removes every image derived with the old one. */
  async write(owner: string, spec: IMediaOverlaySpec | null): Promise<void> {
    const key = MediaOverlayStore.metaKey(owner);
    const previous = await this.read(owner);
    if (!previous && !spec) return;
    const unchanged = previous && spec && MediaOverlayStore.hash(previous) === MediaOverlayStore.hash(spec);
    if (unchanged) return;

    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
    if (!spec) {
      if (existing) await this.db.delete(SystemConstants.TABLE.META, { key });
    } else if (existing) {
      await this.db.update(SystemConstants.TABLE.META, { key }, { value: JSON.stringify(spec) });
    } else {
      await this.db.insert(SystemConstants.TABLE.META, { key, value: JSON.stringify(spec) });
    }
    await MediaOverlayStore.purge(owner);
  }

  /** The cached file for one image under one spec. */
  static cacheFile(owner: string, hash: string, mediaId: string): string {
    return path.join(MediaOverlayStore.ownerDir(owner), hash, `${mediaId}.webp`);
  }

  /** Remove every image derived for this extension in the current site. */
  static async purge(owner: string): Promise<void> {
    await fs.rm(MediaOverlayStore.ownerDir(owner), { recursive: true, force: true });
  }

  private static ownerDir(owner: string): string {
    if (!MediaOverlayStore.isSegment(owner)) throw new Error(`refusing an overlay owner that is not one path segment: "${owner}"`);
    const root = ProjectPaths.withTenantSubdirectory(path.join(ProjectPaths.getDataDir(), MediaOverlayStore.CACHE_DIR));
    return path.join(root, owner);
  }

  private static metaKey(owner: string): string {
    return `${MediaOverlayStore.META_PREFIX}${owner}`;
  }
}
