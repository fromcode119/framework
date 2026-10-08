import { describe, expect, it, vi } from 'vitest';
import { ApiScopeClient } from '@core/clients/api-scope-client';
import { BrowserFileDownload } from '@core/clients/browser-file-download';

const requester = (download?: (path: string, options?: unknown) => Promise<void>) => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), ...(download ? { download } : {}),
});

describe('ApiScopeClient.download', () => {
  it('asks the surface to save the file under this client\'s path', async () => {
    const download = vi.fn(async () => undefined);
    await new ApiScopeClient(requester(download), '/plugins/migrate').download('/sites/package?site=x', { filename: 'x.tar.gz' });
    expect(download).toHaveBeenCalledWith('/plugins/migrate/sites/package?site=x', { filename: 'x.tar.gz' });
  });

  it('refuses on a surface that cannot download, rather than failing somewhere unclear', async () => {
    await expect(new ApiScopeClient(requester(), '/plugins/migrate').download('/x')).rejects.toThrow('cannot download');
  });
});

describe('BrowserFileDownload', () => {
  it('reads the name the server gave the file', () => {
    const response = new Response('', { headers: { 'content-disposition': 'attachment; filename="shop.bg-migration.tar.gz"' } });
    expect(BrowserFileDownload.filenameOf(response)).toBe('shop.bg-migration.tar.gz');
  });

  it('writes the bytes to the picked file as they arrive, saying how far it got', async () => {
    const written: number[] = [];
    const writable = new WritableStream<Uint8Array>({ write: (chunk) => { written.push(...chunk); } });
    const progress: number[] = [];
    const response = new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'content-length': '4' } });

    await BrowserFileDownload.save(response, { writable }, { onProgress: (state) => progress.push(state.loadedBytes) });

    expect(written).toEqual([1, 2, 3, 4]);
    expect(progress[progress.length - 1]).toBe(4);
  });
});
