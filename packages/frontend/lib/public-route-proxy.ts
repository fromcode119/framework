import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
import { ServerApiUtils } from './server-api';

type PublicRouteDefinition = {
  pluginSlug: string;
  path: string;
  targetPath: string;
  contentType: string;
};

export class PublicRouteProxy {
  private static readonly DEFAULT_CONTENT_TYPE = 'text/plain; charset=utf-8';
  private static readonly FORWARDED_HEADERS = [
    'cache-control',
    'content-type',
    'etag',
    'expires',
    'last-modified',
    'x-robots-tag',
  ];

  static async getResponse(path: string): Promise<Response> {
    noStore();

    const route = await PublicRouteProxy.resolveRoute(path);
    if (!route) {
      return new NextResponse('Not found', {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    const response = await ServerApiUtils.serverFetchResponse(
      ServerApiUtils.buildPluginPath(route.pluginSlug, route.targetPath),
      { headers: await PublicRouteProxy.createUpstreamRequestHeaders() },
    );

    if (!response) {
      return new NextResponse('Upstream public route unavailable', {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return new NextResponse(await response.text(), {
      status: response.status,
      headers: PublicRouteProxy.createForwardHeaders(response.headers, route.contentType),
    });
  }

  private static async resolveRoute(path: string): Promise<PublicRouteDefinition | null> {
    const normalizedPath = PublicRouteProxy.normalizePath(path);
    if (!normalizedPath) {
      return null;
    }

    const metadata = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemFrontendPath()) as Record<string, unknown> | null;
    const plugins = Array.isArray(metadata?.plugins) ? metadata.plugins as Array<Record<string, unknown>> : [];

    for (const plugin of plugins) {
      const pluginSlug = String(plugin?.slug || '').trim();
      const ui = plugin?.ui as Record<string, unknown> | undefined;
      const publicRoutes = Array.isArray(ui?.publicRoutes) ? ui?.publicRoutes as Array<Record<string, unknown>> : [];

      for (const route of publicRoutes) {
        if (PublicRouteProxy.normalizePath(route?.path) !== normalizedPath) {
          continue;
        }

        return {
          pluginSlug,
          path: normalizedPath,
          targetPath: PublicRouteProxy.normalizePath(route?.targetPath) || normalizedPath,
          contentType: String(route?.contentType || '').trim() || PublicRouteProxy.DEFAULT_CONTENT_TYPE,
        };
      }
    }

    return null;
  }

  private static createForwardHeaders(headers: Headers, fallbackContentType: string): Headers {
    const forwarded = new Headers();

    for (const header of PublicRouteProxy.FORWARDED_HEADERS) {
      const value = headers.get(header);
      if (value) {
        forwarded.set(header, value);
      }
    }

    if (!forwarded.has('content-type')) {
      forwarded.set('content-type', fallbackContentType || PublicRouteProxy.DEFAULT_CONTENT_TYPE);
    }

    return forwarded;
  }

  private static async createUpstreamRequestHeaders(): Promise<Headers | undefined> {
    const requestHeaders = await headers();
    const forwardedHeaders = new Headers();
    const publicHost = PublicRouteProxy.normalizeHeaderValue(
      requestHeaders.get('x-forwarded-host') || requestHeaders.get('host'),
    );
    const publicProto = PublicRouteProxy.normalizeHeaderValue(
      requestHeaders.get('x-forwarded-proto'),
    );

    if (publicHost) {
      forwardedHeaders.set('host', publicHost);
      forwardedHeaders.set('x-forwarded-host', publicHost);
    }

    if (publicProto) {
      forwardedHeaders.set('x-forwarded-proto', publicProto);
    }

    return Array.from(forwardedHeaders.keys()).length > 0 ? forwardedHeaders : undefined;
  }

  private static normalizeHeaderValue(value: string | null): string {
    return String(value || '').split(',')[0].trim();
  }

  private static normalizePath(value: unknown): string {
    return String(value || '').trim().replace(/^\/+/, '');
  }
}