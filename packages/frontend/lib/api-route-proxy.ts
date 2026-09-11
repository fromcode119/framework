import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { ProxyHeaderRules } from '@fromcode119/core/api/proxy-header-rules';
import { ServerApiUtils } from '@/lib/server-api/server-api';

/**
 * Same-origin proxy to the framework API. The header rules — which hop-by-hop headers to drop each
 * way, and forwarding the public host that identifies the SITE — are shared with the admin's copy in
 * `ProxyHeaderRules`; each app keeps only its own upstream fetch.
 */
export class ApiRouteProxy {
  static async getResponse(request: Request): Promise<Response> {
    noStore();

    const upstreamResponse = await ServerApiUtils.serverFetchInternalResponse(
      ApiRouteProxy.buildUpstreamPath(request),
      ApiRouteProxy.buildRequestInit(request),
    );

    if (!upstreamResponse) {
      return new NextResponse('Upstream API unavailable', {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return new NextResponse(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: ProxyHeaderRules.forDownstreamResponse(upstreamResponse.headers),
    });
  }

  private static buildUpstreamPath(request: Request): string {
    const url = new URL(request.url);
    return `${url.pathname}${url.search}`;
  }

  private static buildRequestInit(request: Request): RequestInit {
    const method = request.method.toUpperCase();
    const headers = ProxyHeaderRules.forUpstreamRequest(request);

    if (method === 'GET' || method === 'HEAD') {
      return { method, headers };
    }

    return {
      method,
      headers,
      body: request.body,
      duplex: 'half',
    } as RequestInit;
  }
}
