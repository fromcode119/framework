import { NextResponse } from 'next/server';
import { ServerApiUtils } from '@/lib/server-api/server-api';

/**
 * Serves a site icon (favicon, apple-touch-icon) from the active theme's public assets, then the
 * framework's default mark, then 204 — so an icon the root layout declares never 404s. Shared by the
 * icon route handlers; the resolver decides WHICH files count, this decides HOW they are served.
 */
export class ThemeIconRouteService {
  static async serve(
    resolved: { themeAssetPaths: string[]; frameworkFallbackPath: string },
    request: Request,
    defaultContentType: string,
    logLabel: string,
  ): Promise<NextResponse> {
    try {
      for (const assetPath of resolved.themeAssetPaths) {
        const assetResponse = await ServerApiUtils.serverFetchInternalResponse(assetPath);
        if (!assetResponse?.ok) {
          continue;
        }
        return ThemeIconRouteService.okResponse(await assetResponse.arrayBuffer(), assetResponse.headers.get('content-type') || defaultContentType);
      }

      const fallbackResponse = await fetch(new URL(resolved.frameworkFallbackPath, request.url), { cache: 'no-store' });
      if (fallbackResponse.ok) {
        return ThemeIconRouteService.okResponse(await fallbackResponse.arrayBuffer(), fallbackResponse.headers.get('content-type') || 'image/png');
      }

      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'public, max-age=86400' } });
    } catch (error) {
      console.error(`[frontend/${logLabel}] Failed to serve icon:`, error);
      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'public, max-age=300' } });
    }
  }

  private static okResponse(body: ArrayBuffer, contentType: string): NextResponse {
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
    });
  }
}
