import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, HEAD } from '../app/api/[...path]/route';
import { ServerApiUtils } from '../lib/server-api';

describe('ApiRouteProxy route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proxies GET requests to the internal API with path and query intact', async () => {
    vi.spyOn(ServerApiUtils, 'serverFetchInternalResponse').mockResolvedValue(
      new Response('image-bytes', {
        status: 200,
        headers: {
          'content-type': 'image/webp',
          'cache-control': 'public, max-age=2592000',
        },
      }),
    );

    const response = await GET(new Request('http://frontend.framework.local/api/v1/themes/vselenskiportal88/ui/logo.webp?x=1'));

    expect(ServerApiUtils.serverFetchInternalResponse).toHaveBeenCalledWith(
      '/api/v1/themes/vselenskiportal88/ui/logo.webp?x=1',
      expect.objectContaining({ method: 'GET', headers: expect.any(Headers) }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toBe('public, max-age=2592000');
  });

  it('proxies HEAD requests to the internal API', async () => {
    vi.spyOn(ServerApiUtils, 'serverFetchInternalResponse').mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          'content-type': 'image/webp',
        },
      }),
    );

    const response = await HEAD(new Request('http://frontend.framework.local/api/v1/themes/vselenskiportal88/ui/logo.webp', { method: 'HEAD' }));

    expect(ServerApiUtils.serverFetchInternalResponse).toHaveBeenCalledWith(
      '/api/v1/themes/vselenskiportal88/ui/logo.webp',
      expect.objectContaining({ method: 'HEAD', headers: expect.any(Headers) }),
    );
    expect(response.status).toBe(200);
  });
});
