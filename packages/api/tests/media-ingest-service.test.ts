import { describe, expect, it, vi } from 'vitest';
import { MediaIngestService } from '@api/services/media-ingest-service';

describe('MediaIngestService', () => {
  const limit = MediaIngestService.UPLOAD_MAX_BYTES;

  it.each([
    'http://127.0.0.1/private',
    'http://10.0.0.5/private',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/private',
  ])('refuses non-public source URL %s', async (sourceUrl) => {
    await expect(MediaIngestService.fetchRemoteBytes(sourceUrl, limit)).rejects.toThrow(/non-public/i);
  });

  it('refuses non-http protocols', async () => {
    await expect(MediaIngestService.fetchRemoteBytes('file:///etc/passwd', limit)).rejects.toThrow(/HTTP or HTTPS/);
  });

  it('refuses URL credentials before fetching', async () => {
    await expect(MediaIngestService.fetchRemoteBytes('https://user:pass@example.com/file', limit)).rejects.toThrow(/credentials/i);
  });

  it('caps base64 input at the given limit', async () => {
    const oversized = Buffer.alloc(1024 * 1024 + 1).toString('base64');
    await expect(MediaIngestService.readBytes({ base64: oversized }, 1024 * 1024)).rejects.toThrow(/1 MB/);
  });

  it('requires a source', async () => {
    await expect(MediaIngestService.readBytes({}, limit)).rejects.toThrow(/base64 or sourceUrl/);
  });

  it('stores under a fresh filename and writes the media row', async () => {
    const db = { insert: vi.fn(async () => ({ id: 41 })), update: vi.fn() };
    const mediaManager = {
      upload: vi.fn(async (_bytes: Buffer, filename: string) => ({ url: `/uploads/${filename}`, path: filename, size: 3, mimeType: 'image/png', provider: 'local', space: 'public' })),
      createWebPVariant: vi.fn(async () => null),
      publicUrl: vi.fn(),
    } as any;

    const result = await new MediaIngestService(db, mediaManager).ingest({ filename: 'logo.png', base64: 'AAAA', alt: 'Logo' }, limit);

    const storedName = mediaManager.upload.mock.calls[0][1] as string;
    expect(storedName).toMatch(/^logo-[0-9a-f-]{36}\.png$/);
    expect(db.insert).toHaveBeenCalledWith('media', expect.objectContaining({ filename: storedName, originalName: 'logo.png', alt: 'Logo', mimeType: 'image/png' }));
    expect(result).toEqual(expect.objectContaining({ id: 41, replaced: false, url: `/uploads/${storedName}` }));
  });

  it('names a raster image by what it is, when its name says another raster format', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
    expect(MediaIngestService.nameForContent('product_3891.jpg', png)).toBe('product_3891.png');
    expect(MediaIngestService.nameForContent('photo.png', jpeg)).toBe('photo.jpg');
    expect(MediaIngestService.nameForContent('photo.jpeg', jpeg)).toBe('photo.jpeg');
    expect(MediaIngestService.nameForContent('notes.pdf', png)).toBe('notes.pdf');
    expect(MediaIngestService.nameForContent('fake.jpg', Buffer.from('not an image at all'))).toBe('fake.jpg');
  });
});
