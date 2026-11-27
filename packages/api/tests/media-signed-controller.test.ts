import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaSignedTokens } from '@fromcode119/core';
import { MediaSignedController } from '@api/controllers/media-signed-controller';

/** A signed address is on the site's own host, so what it serves must never run there as a page. */
describe('MediaSignedController', () => {
  afterEach(() => vi.restoreAllMocks());

  async function serve(mimeType: string): Promise<Record<string, string>> {
    vi.spyOn(MediaSignedTokens.prototype, 'verify').mockResolvedValue('7');
    const manager = { db: { findOne: async () => ({ id: 7, path: 'f', visibility: 'private', mime_type: mimeType, file_size: 3 }) } };
    const media = { stream: async () => Readable.from([Buffer.from('abc')]) };
    const headers: Record<string, string> = {};
    const res: any = { setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; }, status: () => res, end: () => res, destroy: () => undefined };
    res.on = () => res; res.once = () => res; res.emit = () => true; res.write = () => true; res.removeListener = () => res;
    await new MediaSignedController(manager as any, media as any).serve({ params: { token: 't' }, headers: {} } as any, res);
    return headers;
  }

  it('shows a video in place, never sniffed, in a sandbox', async () => {
    const headers = await serve('video/mp4');
    expect(headers['content-type']).toBe('video/mp4');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain('sandbox');
    expect(headers['content-disposition']).toBeUndefined();
  });

  it('sends a page or a drawing as a download', async () => {
    expect((await serve('text/html'))['content-disposition']).toBe('attachment');
    expect((await serve('image/svg+xml'))['content-disposition']).toBe('attachment');
  });
});
