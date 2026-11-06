import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeAssetTextCache } from '@/lib/document/theme-asset-text-cache';

/** A stamped theme file is fetched once per process, not once per page view. */
describe('ThemeAssetTextCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    ThemeAssetTextCache.clear();
  });

  it('fetches a stamped file once', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('body{}'));
    expect(await ThemeAssetTextCache.read('http://api/ui.css?v=abc', true)).toBe('body{}');
    expect(await ThemeAssetTextCache.read('http://api/ui.css?v=abc', true)).toBe('body{}');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches again after a rebuild changes the stamp, and every time when unstamped', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('x'));
    await ThemeAssetTextCache.read('http://api/ui.css?v=1', true);
    await ThemeAssetTextCache.read('http://api/ui.css?v=2', true);
    await ThemeAssetTextCache.read('http://api/ui.css', false);
    await ThemeAssetTextCache.read('http://api/ui.css', false);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('does not remember a failed fetch', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok'));
    expect(await ThemeAssetTextCache.read('http://api/head.js?v=1', true)).toBeNull();
    expect(await ThemeAssetTextCache.read('http://api/head.js?v=1', true)).toBe('ok');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
