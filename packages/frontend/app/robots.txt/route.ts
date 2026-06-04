import { ServerApiUtils } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

/**
 * Serves /robots.txt at the apex by proxying to the SEO plugin's robots endpoint.
 * The catch-all public-route handler only matches `.xml`, so robots needs its own route.
 */
export async function GET(): Promise<Response> {
  const path = ServerApiUtils.buildPluginPath('seo', 'robots.txt');
  const upstream = await ServerApiUtils.serverFetchResponse(path);
  const body = upstream && upstream.ok ? await upstream.text() : 'User-agent: *\nAllow: /\n';
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
