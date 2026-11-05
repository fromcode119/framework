import type sharpModule from 'sharp';
import type { IMediaImageOverlayOptions } from '@media/interfaces/media-image-overlay-options.interface';

/**
 * Lays one image over another — a watermark, a badge, a frame — and returns a new WebP.
 *
 * The base is never modified: the caller hands in bytes and gets new bytes back. Which images get an
 * overlay, with which picture and where, is decided by whoever calls this; nothing here knows why.
 */
export class MediaImageOverlay {
  /** The nine anchors, as `[horizontal, vertical]` factors: 0 = start edge, 0.5 = middle, 1 = end edge. */
  static readonly POSITIONS: Readonly<Record<string, readonly [number, number]>> = {
    'top-left': [0, 0],
    top: [0.5, 0],
    'top-right': [1, 0],
    left: [0, 0.5],
    center: [0.5, 0.5],
    right: [1, 0.5],
    'bottom-left': [0, 1],
    bottom: [0.5, 1],
    'bottom-right': [1, 1],
  };

  /** Loaded on first use, as `MediaImageOptimizer` does: plugin processes import this package too. */
  private static get sharp(): typeof sharpModule {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('sharp');
  }

  static isPosition(value: string): boolean {
    return Object.prototype.hasOwnProperty.call(MediaImageOverlay.POSITIONS, value);
  }

  static async compose(base: Buffer, overlay: Buffer, options: IMediaImageOverlayOptions): Promise<{ buffer: Buffer; mimeType: string }> {
    const anchor = MediaImageOverlay.POSITIONS[options.position];
    if (!anchor) throw new Error(`Unknown overlay position "${options.position}".`);
    const sharp = MediaImageOverlay.sharp;

    const scaled = await sharp(base, { animated: false })
      .rotate()
      .resize(options.maxWidth, options.maxHeight, { fit: 'inside', withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });
    const { width, height } = scaled.info;

    const mark = await MediaImageOverlay.prepareMark(overlay, width, height, options);
    const margin = Math.round((Math.min(width, height) * MediaImageOverlay.clamp(options.marginPercent, 0, 50)) / 100);
    const left = MediaImageOverlay.offset(anchor[0], width, mark.width, margin);
    const top = MediaImageOverlay.offset(anchor[1], height, mark.height, margin);

    const buffer = await sharp(scaled.data)
      .composite([{ input: mark.data, left, top }])
      .webp({ quality: options.quality, effort: 4 })
      .toBuffer();
    return { buffer, mimeType: 'image/webp' };
  }

  /** The overlay scaled to its share of the base, never wider or taller than the base, with its opacity applied. */
  private static async prepareMark(
    overlay: Buffer,
    baseWidth: number,
    baseHeight: number,
    options: IMediaImageOverlayOptions,
  ): Promise<{ data: Buffer; width: number; height: number }> {
    const sharp = MediaImageOverlay.sharp;
    const targetWidth = Math.max(1, Math.round((baseWidth * MediaImageOverlay.clamp(options.sizePercent, 1, 100)) / 100));
    const resized = await sharp(overlay, { animated: false })
      .resize(targetWidth, baseHeight, { fit: 'inside' })
      .ensureAlpha()
      .png()
      .toBuffer({ resolveWithObject: true });

    const alpha = Math.round((255 * MediaImageOverlay.clamp(options.opacityPercent, 0, 100)) / 100);
    const faded = await sharp(resized.data)
      .composite([{ input: Buffer.from([255, 255, 255, alpha]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
      .png()
      .toBuffer();
    return { data: faded, width: resized.info.width, height: resized.info.height };
  }

  /** Where the mark starts along one axis, kept inside the base. */
  private static offset(factor: number, baseSize: number, markSize: number, margin: number): number {
    const free = Math.max(0, baseSize - markSize);
    const inset = Math.min(margin, Math.floor(free / 2));
    const raw = factor === 0 ? inset : factor === 1 ? free - inset : Math.round(free / 2);
    return Math.max(0, Math.min(free, raw));
  }

  private static clamp(value: number, min: number, max: number): number {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }
}
