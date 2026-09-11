import { unstable_noStore as noStore } from 'next/cache';
import { ProxyHeaderRules } from '@fromcode119/core/api/proxy-header-rules';
import { ApplicationUrlUtils } from '@fromcode119/core/client';

/**
 * Same-origin proxy to the framework API — the admin's twin of the storefront's.
 *
 * The admin bundle calls the API on the host it was served from: `NEXT_PUBLIC_API_URL` is inlined at
 * image BUILD time, so a published image carries none and `RuntimeBridge.resolveApiBaseUrl()` falls
 * through to `window.location.origin`. Behind the framework gateway those `/api/*` paths never reach
 * this route; a deployment behind its own proxy (Traefik, nginx, Caddy) has nothing else serving
 * them, and the admin answered every one with its 404 HTML page — the whole console failed on
 * `Unexpected token '<'`, including the first-run setup screen. This is what that deployment falls
 * back to.
 */
export class AdminApiRouteProxy {
  static async getResponse(request: Request): Promise<Response> {
    noStore();

    const baseUrl = AdminApiRouteProxy.resolveUpstreamBaseUrl();
    if (!baseUrl) {
      return AdminApiRouteProxy.plainText('No API URL configured for this deployment', 502);
    }

    const upstreamResponse = await AdminApiRouteProxy.fetchUpstream(baseUrl, request);
    if (!upstreamResponse) {
      return AdminApiRouteProxy.plainText('Upstream API unavailable', 502);
    }

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: ProxyHeaderRules.forDownstreamResponse(upstreamResponse.headers),
    });
  }

  private static async fetchUpstream(baseUrl: string, request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    try {
      return await fetch(`${baseUrl}${url.pathname}${url.search}`, AdminApiRouteProxy.buildRequestInit(request));
    } catch (error) {
      console.error(`[admin] API proxy could not reach ${baseUrl}${url.pathname}: ${error}`);
      return null;
    }
  }

  /**
   * The INTERNAL address, so the call stays on the container network instead of going back out
   * through the public proxy and its TLS. Compose sets `API_URL` from `INTERNAL_API_URL` for exactly
   * this; core's candidates cover a deployment that set neither. An unresolved base is reported as a
   * 502 above rather than guessed at.
   */
  private static resolveUpstreamBaseUrl(): string {
    const configured = String(process.env.INTERNAL_API_URL || process.env.API_URL || '').trim();
    if (configured) {
      return configured.replace(/\/+$/, '');
    }
    return ApplicationUrlUtils.getServerApiBaseUrlCandidates()[0] || '';
  }

  private static buildRequestInit(request: Request): RequestInit {
    const method = request.method.toUpperCase();
    const headers = ProxyHeaderRules.forUpstreamRequest(request);

    if (method === 'GET' || method === 'HEAD') {
      return { method, headers, cache: 'no-store' };
    }

    return {
      method,
      headers,
      body: request.body,
      cache: 'no-store',
      duplex: 'half',
    } as RequestInit;
  }

  private static plainText(message: string, status: number): Response {
    return new Response(message, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
