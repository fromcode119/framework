import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { ServerApiUtils } from './server-api';

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
      headers: ApiRouteProxy.buildResponseHeaders(upstreamResponse.headers),
    });
  }

  private static buildUpstreamPath(request: Request): string {
    const url = new URL(request.url);
    return `${url.pathname}${url.search}`;
  }

  private static buildRequestInit(request: Request): RequestInit {
    const method = request.method.toUpperCase();
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('content-length');

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

  private static buildResponseHeaders(headers: Headers): Headers {
    const forwarded = new Headers(headers);
    forwarded.delete('connection');
    forwarded.delete('keep-alive');
    forwarded.delete('transfer-encoding');
    return forwarded;
  }
}
