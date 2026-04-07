import { headers } from 'next/headers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicRouteProxy } from '../lib/public-route-proxy';
import { ServerApiUtils } from '../lib/server-api';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

describe('PublicRouteProxy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proxies a public route and forwards selected headers', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({
      host: 'frontend.framework.local',
      'x-forwarded-proto': 'https',
    }));
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      plugins: [
        {
          slug: 'content',
          ui: {
            publicRoutes: [
              {
                path: 'feed.xml',
                contentType: 'application/xml; charset=utf-8',
              },
            ],
          },
        },
      ],
    });
    vi.spyOn(ServerApiUtils, 'buildPluginPath').mockReturnValue('/api/v1/plugins/content/feed.xml');
    vi.spyOn(ServerApiUtils, 'serverFetchResponse').mockResolvedValue(
      new Response('<feed />', {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300',
          'Content-Type': 'application/xml; charset=utf-8',
          ETag: 'feed-etag',
        },
      }),
    );

    const response = await PublicRouteProxy.getResponse('feed.xml');

    expect(ServerApiUtils.buildPluginPath).toHaveBeenCalledWith('content', 'feed.xml');
    expect(ServerApiUtils.serverFetchResponse).toHaveBeenCalledTimes(1);
    expect(ServerApiUtils.serverFetchResponse).toHaveBeenCalledWith(
      '/api/v1/plugins/content/feed.xml',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const forwardedRequest = vi.mocked(ServerApiUtils.serverFetchResponse).mock.calls[0]?.[1] as RequestInit;
    const forwardedHeaders = forwardedRequest.headers as Headers;
    expect(forwardedHeaders.get('host')).toBe('frontend.framework.local');
    expect(forwardedHeaders.get('x-forwarded-host')).toBe('frontend.framework.local');
    expect(forwardedHeaders.get('x-forwarded-proto')).toBe('https');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(response.headers.get('etag')).toBe('feed-etag');
    expect(await response.text()).toBe('<feed />');
  });

  it('returns a gateway error when the upstream public route is unavailable', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ host: 'frontend.framework.local' }));
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      plugins: [
        {
          slug: 'content',
          ui: {
            publicRoutes: [
              {
                path: 'directory.xml',
                contentType: 'application/xml; charset=utf-8',
              },
            ],
          },
        },
      ],
    });
    vi.spyOn(ServerApiUtils, 'buildPluginPath').mockReturnValue('/api/v1/plugins/content/directory.xml');
    vi.spyOn(ServerApiUtils, 'serverFetchResponse').mockResolvedValue(null);

    const response = await PublicRouteProxy.getResponse('directory.xml');

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('Upstream public route unavailable');
  });

  it('returns not found when no plugin claims the requested public route', async () => {
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({ plugins: [] });

    const response = await PublicRouteProxy.getResponse('catalog.xml');

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found');
  });
});