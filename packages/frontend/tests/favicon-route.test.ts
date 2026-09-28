import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';
import { ApiPathUtils } from '@fromcode119/core/client';

// Route files export only the class — see RouteExportPlugin.
import { FaviconRoute } from '@/app/favicon.ico/route';
import { FrontendPublicFile } from '@/lib/theme/frontend-public-file';
import { ServerApiUtils } from '@/lib/server-api/server-api';

describe('favicon route', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  function createResponse(body: string, contentType: string, status = 200): Response {
    return new Response(body, {
      status,
      headers: {
        'content-type': contentType,
      },
    });
  }

  it('serves the active theme favicon from theme public assets', async () => {
    vi.spyOn(ServerApiPaths, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      activeTheme: { slug: 'example-theme' },
    });
    vi.spyOn(ServerApiUtils, 'serverFetchInternalResponse').mockResolvedValue(
      createResponse('ico', 'image/x-icon'),
    );

    const response = await FaviconRoute.GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/x-icon');
    expect(ServerApiUtils.serverFetchInternalResponse).toHaveBeenCalledWith(
      ApiPathUtils.themePublicAssetPath('example-theme', 'favicon.ico'),
    );
  });

  it('falls back to the framework favicon when the active theme has no favicon asset', async () => {
    vi.spyOn(ServerApiPaths, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      activeTheme: { slug: 'theme-a-theme' },
    });
    vi.spyOn(ServerApiUtils, 'serverFetchInternalResponse').mockResolvedValue(createResponse('', 'text/plain', 404));
    // The fallback is read from the frontend's own public/ on disk. A fetch of this server's public URL
    // failed inside the container and served an empty 204, so a network call here is itself the bug.
    const fetchSpy = vi.fn(async () => { throw new Error('fetch failed'); });
    vi.stubGlobal('fetch', fetchSpy);

    const response = await FaviconRoute.GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 204 when no theme or framework favicon is available', async () => {
    vi.spyOn(ServerApiPaths, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      activeTheme: { slug: 'theme-a-theme' },
    });
    vi.spyOn(ServerApiUtils, 'serverFetchInternalResponse').mockResolvedValue(createResponse('', 'text/plain', 404));
    vi.spyOn(FrontendPublicFile, 'read').mockResolvedValue(null);

    const response = await FaviconRoute.GET();

    expect(response.status).toBe(204);
  });

  it('falls back to the framework favicon when theme resolution throws', async () => {
    vi.spyOn(ServerApiPaths, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockRejectedValue(new Error('metadata unavailable'));
    vi.spyOn(ServerApiUtils, 'serverFetchInternalResponse').mockResolvedValue(createResponse('', 'text/plain', 404));
    const response = await FaviconRoute.GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
  });
});