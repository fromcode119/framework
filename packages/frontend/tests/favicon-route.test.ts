import { afterEach, describe, expect, it, vi } from 'vitest';

// Route files export only the class — see RouteExportPlugin.
import { FaviconRoute } from '@/app/favicon.ico/route';
import { AppleTouchIconRoute } from '@/app/apple-touch-icon.png/route';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { FrontendPublicFile } from '@/lib/theme/frontend-public-file';

describe('site icon routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const siteIcon = (favicon: Record<string, string>, appleTouchIcon: Record<string, string> = {}) =>
    vi.spyOn(FrontendConfigCache, 'read').mockResolvedValue({ siteIcon: { favicon, appleTouchIcon, themeFavicon: {} } });

  it('redirects to the icon picked in the admin — an upload is not an api route, so it is not proxied', async () => {
    siteIcon({ source: 'setting', path: '/uploads/icon-7.png', file: '' });

    const response = await FaviconRoute.GET();

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/uploads/icon-7.png');
  });

  it("redirects to the active theme's own file when nothing is picked", async () => {
    siteIcon(
      { source: 'theme', path: '/api/themes/aurora/ui/favicon.ico', file: 'favicon.ico' },
      { source: 'theme', path: '/api/themes/aurora/ui/apple-touch-icon.png', file: 'apple-touch-icon.png' },
    );

    expect((await FaviconRoute.GET()).headers.get('location')).toBe('/api/themes/aurora/ui/favicon.ico');
    expect((await AppleTouchIconRoute.GET()).headers.get('location')).toBe('/api/themes/aurora/ui/apple-touch-icon.png');
  });

  it("serves the platform's mark from disk when the site has no icon of its own", async () => {
    siteIcon({ source: 'platform', path: '', file: '' });
    // Read from the frontend's own public/ on disk. A fetch of this server's public URL failed inside
    // the container and served an empty 204, so a network call here is itself the bug.
    const fetchSpy = vi.fn(async () => { throw new Error('fetch failed'); });
    vi.stubGlobal('fetch', fetchSpy);

    const response = await FaviconRoute.GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("serves the platform's mark when the frontend payload cannot be read", async () => {
    vi.spyOn(FrontendConfigCache, 'read').mockRejectedValue(new Error('metadata unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await FaviconRoute.GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
  });

  it('returns 204 when not even the platform mark is available', async () => {
    siteIcon({});
    vi.spyOn(FrontendPublicFile, 'read').mockResolvedValue(null);

    expect((await FaviconRoute.GET()).status).toBe(204);
  });
});
