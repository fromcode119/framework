import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../app/favicon.ico/route';
import { ServerApiUtils } from '../lib/server-api';

describe('favicon route', () => {
  const originalInternalApiUrl = process.env.INTERNAL_API_URL;

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env.INTERNAL_API_URL = originalInternalApiUrl;
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
    process.env.INTERNAL_API_URL = 'http://api:3000';
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      activeTheme: { slug: 'vselenskiportal88' },
    });
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      if (String(input) === 'http://api:3000/api/v1/themes/vselenskiportal88/public/favicon.ico') {
        return createResponse('ico', 'image/x-icon');
      }
      return createResponse('', 'text/plain', 404);
    }));

    const response = await GET(new Request('http://frontend.framework.local/favicon.ico'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/x-icon');
  });

  it('falls back to the framework favicon when the active theme has no favicon asset', async () => {
    process.env.INTERNAL_API_URL = 'http://api:3000';
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      activeTheme: { slug: 'snapbilt-theme' },
    });
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      if (String(input).startsWith('http://api:3000/api/v1/themes/snapbilt-theme/public/')) {
        return createResponse('', 'text/plain', 404);
      }
      if (String(input) === 'http://frontend.framework.local/brand/atlantis-mark-indigo.png') {
        return createResponse('fallback', 'image/png');
      }
      return createResponse('', 'text/plain', 404);
    }));

    const response = await GET(new Request('http://frontend.framework.local/favicon.ico'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
  });

  it('returns 204 when no theme or framework favicon is available', async () => {
    process.env.INTERNAL_API_URL = 'http://api:3000';
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      activeTheme: { slug: 'snapbilt-theme' },
    });
    vi.stubGlobal('fetch', vi.fn(async () => createResponse('', 'text/plain', 404)));

    const response = await GET(new Request('http://frontend.framework.local/favicon.ico'));

    expect(response.status).toBe(204);
  });

  it('falls back to the framework favicon when theme resolution throws', async () => {
    process.env.INTERNAL_API_URL = 'http://api:3000';
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockRejectedValue(new Error('metadata unavailable'));
    vi.stubGlobal('fetch', vi.fn(async () => createResponse('fallback', 'image/png')));

    const response = await GET(new Request('http://frontend.framework.local/favicon.ico'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
  });
});