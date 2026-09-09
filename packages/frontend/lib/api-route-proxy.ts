import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { ServerApiUtils } from '@/lib/server-api/server-api';

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
    // `fetch` DECODES the upstream body, so the `arrayBuffer()` above holds plain bytes. Forwarding the
    // upstream's `Content-Encoding: gzip` alongside them tells the browser to gunzip text that is not
    // gzipped: every theme and plugin bundle failed with ERR_CONTENT_DECODING_FAILED and the storefront
    // ran server-rendered only, with no client runtime at all. The compressed `Content-Length` goes with
    // it — it describes bytes that are no longer being sent, and the platform sets the real one.
    forwarded.delete('content-encoding');
    forwarded.delete('content-length');
    return forwarded;
  }
}
