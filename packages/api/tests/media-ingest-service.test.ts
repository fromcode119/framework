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
});
