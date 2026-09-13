import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteVisibilityProxyGuard } from '@/lib/document/site-visibility-proxy-guard';

/**
 * The guard memoises per host. These tests use a distinct host each, rather than reaching into the
 * cache to clear it: a test that needs private state reset is a test that is not exercising the
 * class the way a request does.
 */
const answer = (payload: Record<string, unknown>) => ({ ok: true, json: async () => payload }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SiteVisibilityProxyGuard', () => {
  it('serves a published site and closes an unpublished one', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer({ site: { isReadable: true, preview: false } })));
    expect(await SiteVisibilityProxyGuard.isReadable('open.test', 'http://api', '')).toBe(true);

    vi.stubGlobal('fetch', vi.fn(async () => answer({ site: { isReadable: false, preview: false } })));
    expect(await SiteVisibilityProxyGuard.isReadable('closed.test', 'http://api', '')).toBe(false);
  });

  it('opens a closed site for a caller the api recognises, and forwards only the preview cookie', async () => {
    const fetchMock = vi.fn(async () => answer({ site: { isReadable: false, preview: true } }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await SiteVisibilityProxyGuard.isReadable('preview.test', 'http://api', 'session-value')).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers.cookie).toBe('fc_site_preview=session-value');
  });

  it('never serves a preview verdict to an anonymous visitor of the same host', async () => {
    // The verdict is cached, and the cache key includes the credential. Without that, whichever of
    // these two ran first would answer for the other — either leaking the site or locking out its
    // own operator.
    const fetchMock = vi.fn(async (_url: string, init: any) => answer({
      site: { isReadable: false, preview: Boolean(init?.headers?.cookie) },
    }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await SiteVisibilityProxyGuard.isReadable('shared.test', 'http://api', 'session-value')).toBe(true);
    expect(await SiteVisibilityProxyGuard.isReadable('shared.test', 'http://api', '')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses one verdict per caller within the window rather than asking again', async () => {
    const fetchMock = vi.fn(async () => answer({ site: { isReadable: true, preview: false } }));
    vi.stubGlobal('fetch', fetchMock);

    await SiteVisibilityProxyGuard.isReadable('cached.test', 'http://api', '');
    await SiteVisibilityProxyGuard.isReadable('cached.test', 'http://api', '');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails OPEN when the api cannot be reached — a lookup failure never takes a site down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('unreachable'); }));
    expect(await SiteVisibilityProxyGuard.isReadable('down.test', 'http://api', '')).toBe(true);
  });
});
