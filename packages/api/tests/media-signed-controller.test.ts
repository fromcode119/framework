import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaSignedTokens } from '@fromcode119/core';
import { MediaSignedController } from '@api/controllers/media-signed-controller';

/** A signed address is on the site's own host, so what it serves must never run there as a page. */
describe('MediaSignedController', () => {
  afterEach(() => vi.restoreAllMocks());

  async function serve(mimeType: string, request: { params: Record<string, string>; query?: Record<string, string> } = { params: { token: 't' } }): Promise<Record<string, string>> {
    vi.spyOn(MediaSignedTokens.prototype, 'verify').mockImplementation(async (token: string) => (token === 't' ? '7' : null));
    const manager = { db: { findOne: async () => ({ id: 7, path: 'f', visibility: 'private', mime_type: mimeType, file_size: 3 }) } };
    const media = { stream: async () => Readable.from([Buffer.from('abc')]) };
    const headers: Record<string, string> = {};
    const res: any = { setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; }, status: () => res, end: () => res, destroy: () => undefined };
    res.on = () => res; res.once = () => res; res.emit = () => true; res.write = () => true; res.removeListener = () => res;
    let status = 200;
    res.status = (code: number) => { status = code; return res; };
    await new MediaSignedController(manager as any, media as any).serve({ ...request, headers: {} } as any, res);
    headers[':status'] = String(status);
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

  // The path names the file and the token rides in the query, so a phone keeps one copy per file whatever the token.
  it('serves the file a path names with the token in the query, and only the file the token was made for', async () => {
    expect((await serve('video/mp4', { params: { token: '7', file: 'file.mp4' }, query: { t: 't' } }))['content-type']).toBe('video/mp4');
    expect((await serve('video/mp4', { params: { token: '8', file: 'file.mp4' }, query: { t: 't' } }))[':status']).toBe('404');
    expect((await serve('video/mp4', { params: { token: '7', file: 'file.mp4' }, query: {} }))[':status']).toBe('404');
  });
});
