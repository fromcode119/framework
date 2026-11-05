import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { MediaImageOverlay } from '@media/media-image-overlay';

const OUTPUT = { maxWidth: 1600, maxHeight: 1600, quality: 90 };

const solid = (width: number, height: number, rgb: [number, number, number]): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();

const pixel = async (image: Buffer, x: number, y: number): Promise<number[]> => {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return [data[offset], data[offset + 1], data[offset + 2]];
};

describe('MediaImageOverlay', () => {
  it('lays the overlay at the anchor, scaled to its share of the base, and leaves the rest alone', async () => {
    const base = await solid(400, 200, [255, 255, 255]);
    const mark = await solid(100, 100, [0, 0, 0]);
    const result = await MediaImageOverlay.compose(base, mark, { position: 'bottom-right', opacityPercent: 100, sizePercent: 25, marginPercent: 0, ...OUTPUT });

    expect(result.mimeType).toBe('image/webp');
    const meta = await sharp(result.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([400, 200]);
    // The mark is 100x100 (25% of 400), in the bottom-right corner.
    expect((await pixel(result.buffer, 350, 150))[0]).toBeLessThan(30);
    expect((await pixel(result.buffer, 50, 50))[0]).toBeGreaterThan(225);
  });

  it('applies the opacity', async () => {
    const base = await solid(200, 200, [255, 255, 255]);
    const mark = await solid(50, 50, [0, 0, 0]);
    const result = await MediaImageOverlay.compose(base, mark, { position: 'center', opacityPercent: 50, sizePercent: 100, marginPercent: 0, ...OUTPUT });
    const [red] = await pixel(result.buffer, 100, 100);
    expect(red).toBeGreaterThan(100);
    expect(red).toBeLessThan(160);
  });

  it('keeps the margin from the anchored edges', async () => {
    const base = await solid(400, 400, [255, 255, 255]);
    const mark = await solid(40, 40, [0, 0, 0]);
    const result = await MediaImageOverlay.compose(base, mark, { position: 'top-left', opacityPercent: 100, sizePercent: 10, marginPercent: 10, ...OUTPUT });
    expect((await pixel(result.buffer, 20, 20))[0]).toBeGreaterThan(225);
    expect((await pixel(result.buffer, 60, 60))[0]).toBeLessThan(30);
  });

  it('refuses an unknown position', async () => {
    const base = await solid(10, 10, [255, 255, 255]);
    await expect(MediaImageOverlay.compose(base, base, { position: 'middle', opacityPercent: 50, sizePercent: 10, marginPercent: 0, ...OUTPUT })).rejects.toThrow(/position/);
  });
});
