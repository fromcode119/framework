import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';
import { MediaContextProxy } from '@core/plugin/context/media';

const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

/** A site's media rows as its tenant-scoped read sees them, and a storage that streams their bytes. */
const managerWith = (rows: Record<string, Record<string, unknown>>, files: Record<string, Buffer>) => ({
  db: { findOne: vi.fn(async (_table: string, where: { id: unknown }) => rows[String(where.id)] ?? null) },
  integrations: { storage: { stream: vi.fn(async (path: string) => Readable.from([files[path]])) } },
}) as any;

describe('context.media.read', () => {
  it('hands over a stored file\'s bytes with its name and type', async () => {
    const bytes = Buffer.from('\x89PNG fake image bytes');
    const media = MediaContextProxy.createMediaProxy(
      managerWith({ 7: { id: 7, path: 'product-1-abc.png', original_name: 'product_1.png', mime_type: 'image/png', visibility: 'public' } }, { 'product-1-abc.png': bytes }),
      security,
    );

    const file = await media.read(7);

    expect(file).toEqual({ filename: 'product_1.png', mimeType: 'image/png', size: bytes.length, base64: bytes.toString('base64') });
  });

  it('answers null for an id this site does not hold', async () => {
    const media = MediaContextProxy.createMediaProxy(managerWith({}, {}), security);
    await expect(media.read(99)).resolves.toBeNull();
  });

  it('answers null rather than buffering a file over the read limit', async () => {
    const big = Buffer.alloc(MediaContextProxy.MAX_READ_BYTES + 1);
    const media = MediaContextProxy.createMediaProxy(managerWith({ 1: { id: 1, path: 'big.bin' } }, { 'big.bin': big }), security);
    await expect(media.read(1)).resolves.toBeNull();
  });
});
