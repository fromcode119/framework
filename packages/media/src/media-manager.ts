
import path from 'path';
import type { IStorageDriver } from '@media/interfaces/storage-driver.interface';
import { MediaImageOptimizer } from '@media/media-image-optimizer';
import { MediaMagicByteValidator } from '@media/media-magic-byte-validator';
import { MediaSvgSanitizer } from '@media/media-svg-sanitizer';
import type { IMediaWebPConversionOptions } from '@media/interfaces/media-web-p-conversion-options.interface';

export class MediaManager {
  /**
   * The storage spaces this install has, keyed by name. PUBLIC always exists; PRIVATE exists only
   * where it is configured.
   *
   * One collection rather than a field per space: a second `privateDriver` field would mean every new
   * kind of storage adds another field, another constructor argument and another branch. Keying them
   * also lets the two live on DIFFERENT providers, which is the realistic deployment — public media
   * behind a CDN on S3, private files on local disk, because the S3 driver has no signed-URL support
   * and would otherwise put "private" files in the same world-readable bucket.
   */
  private readonly drivers = new Map<string, IStorageDriver>();

  /**
   * The only space with an inherent meaning: it is the one served statically and therefore the only
   * one whose files have a public URL. Everything else is gated by whoever owns it.
   */
  static readonly PUBLIC_SPACE = 'public';

  /**
   * @param drivers storage spaces by name. `public` is required; add as many others as an install
   *                needs. Falsy entries are dropped, so a factory that declines to build a space
   *                (a misconfigured directory, say) simply results in that space not existing —
   *                `has()` then reports the truth rather than a half-built driver pretending.
   */
  constructor(drivers: Record<string, IStorageDriver | undefined>) {
    Object.entries(drivers || {}).forEach(([space, driver]) => {
      if (driver) this.drivers.set(space, driver);
    });

    if (!this.drivers.has(MediaManager.PUBLIC_SPACE)) {
      throw new Error(`MediaManager requires a "${MediaManager.PUBLIC_SPACE}" storage space`);
    }
  }

  /** Add a space after construction — how a plugin or a later boot phase contributes storage. */
  register(space: string, driver: IStorageDriver): void {
    this.drivers.set(space, driver);
  }

  has(space: string): boolean {
    return this.drivers.has(space);
  }

  get spaces(): string[] {
    return [...this.drivers.keys()];
  }

  /** The public-space driver. Named `driver` because that is what it has always been to callers. */
  get driver(): IStorageDriver {
    return this.drivers.get(MediaManager.PUBLIC_SPACE) as IStorageDriver;
  }

  get provider() { return this.driver.provider; }

  /**
   * The driver that owns a file's bytes.
   *
   * An unknown space THROWS rather than falling back to the public one. Silently downgrading is how a
   * file recorded as private ends up on a permanent public URL — the single failure this whole feature
   * exists to prevent.
   *
   * Spaces are plain strings rather than an enum because core imports media, so media importing core's
   * `MediaVisibility` would close a circular reference. The enum's `.value` IS the space name, so the
   * two line up without the dependency.
   */
  private driverFor(space: string): IStorageDriver {
    const driver = this.drivers.get(space || MediaManager.PUBLIC_SPACE);
    if (!driver) throw new Error(`Storage space "${space}" is not configured`);
    return driver;
  }

  /** Bytes for a stored file, as a stream. Large downloads must not be buffered into memory. */
  async stream(filepath: string, space: string = MediaManager.PUBLIC_SPACE): Promise<NodeJS.ReadableStream> {
    return this.driverFor(space).stream(filepath);
  }

  /**
   * The public URL for a stored file, or `''` when it has none.
   *
   * Only the public space is served statically, so only it can produce a URL. Every other space is
   * gated by whoever owns it and has no address a browser could fetch directly. `''` is this codebase's
   * established way of saying "not configured" (`ApplicationUrlUtils` does the same) — never a
   * fabricated path that would 404 or, worse, resolve.
   */
  publicUrl(filepath: string, space: string = MediaManager.PUBLIC_SPACE): string {
    return space === MediaManager.PUBLIC_SPACE ? this.driver.getUrl(filepath) : '';
  }

  async upload(file: Buffer, filename: string, options?: { space?: string }): Promise<{ url: string; path: string; width?: number; height?: number; size: number; mimeType: string; provider: string; space: string }> {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4'
    };
    let payload = file;
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    let width: number | undefined;
    let height: number | undefined;

    // Reject raster uploads whose content does not match the extension-implied
    // format (magic-byte sniffing) — the MIME type above is derived from the
    // extension alone, so without this check arbitrary content could be stored
    // and served as an image.
    if (MediaMagicByteValidator.canValidate(ext) && !MediaMagicByteValidator.matchesExtension(ext, file)) {
      throw new Error(`Rejected upload "${filename}": file content does not match the ${ext} image format`);
    }

    // SVG is an active document format (stored XSS vector) — sanitize before storage.
    if (ext === '.svg') {
      payload = Buffer.from(MediaSvgSanitizer.sanitize(file.toString('utf8')), 'utf8');
    }

    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        const optimized = await MediaImageOptimizer.optimizeBuffer(file, filename);
        payload = optimized.buffer;
        width = optimized.width;
        height = optimized.height;
    }

    const space = options?.space || MediaManager.PUBLIC_SPACE;
    const targetDriver = this.driverFor(space);
    const filePath = await targetDriver.save(payload, filename);

    return {
      // Empty for any non-public space: those files have no public URL, and this is computed on the
      // happy path right after the bytes land, so it must not be something that can throw.
      url: this.publicUrl(filePath, space),
      path: filePath,
      width,
      height,
      size: payload.length,
      mimeType,
      provider: targetDriver.provider,
      space
    };
  }

  /**
   * Reads an existing stored file, converts it to WebP, and saves the result
   * alongside the original. The original is never modified.
   *
   * @param originalPath - Stored path of the original file (as in the DB `path` column)
   * @param options - Optional resize/quality settings
   * @returns Stored path, URL, dimensions, and byte sizes of the WebP variant
   */
  async createWebPVariant(
    originalPath: string,
    options?: IMediaWebPConversionOptions,
  ): Promise<{ path: string; url: string; width: number; height: number; size: number; originalSize: number }> {
    const original = await this.driver.read(originalPath);
    const result = await MediaImageOptimizer.convertToWebP(original, options);

    const baseName = path.basename(originalPath, path.extname(originalPath));
    const webpFilename = `${baseName}.webp`;
    const savedPath = await this.driver.save(result.buffer, webpFilename);

    return {
      path: savedPath,
      url: this.driver.getUrl(savedPath),
      width: result.width,
      height: result.height,
      size: result.convertedSize,
      originalSize: result.originalSize,
    };
  }

  async remove(filepath: string, space: string = MediaManager.PUBLIC_SPACE): Promise<void> {
    await this.driverFor(space).delete(filepath);
  }
}
