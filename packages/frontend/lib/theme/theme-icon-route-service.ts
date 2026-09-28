import { NextResponse } from 'next/server';
import { ServerApiUtils } from '@/lib/server-api/server-api';
import { FrontendPublicFile } from '@/lib/theme/frontend-public-file';

/**
 * Serves a site icon (favicon, apple-touch-icon) from the active theme's public assets, then the
 * framework's default mark, then 204 — so an icon the root layout declares never 404s. Shared by the
 * icon route handlers; the resolver decides WHICH files count, this decides HOW they are served.
 */
export class ThemeIconRouteService {
  static async serve(
    resolved: { themeAssetPaths: string[]; frameworkFallbackPath: string },
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

      // Read from disk, never fetched from this server's own public URL — from inside the container that
      // request failed, and a site without an icon of its own got an empty 204 instead of this one.
      const fallback = await FrontendPublicFile.read(resolved.frameworkFallbackPath);
      if (fallback) {
        return ThemeIconRouteService.okResponse(fallback, ThemeIconRouteService.contentTypeOf(resolved.frameworkFallbackPath));
      }

      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'public, max-age=86400' } });
    } catch (error) {
      console.error(`[frontend/${logLabel}] Failed to serve icon:`, error);
      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'public, max-age=300' } });
    }
  }

  private static contentTypeOf(path: string): string {
    if (path.endsWith('.svg')) return 'image/svg+xml';
    if (path.endsWith('.ico')) return 'image/x-icon';
    return 'image/png';
  }

  private static okResponse(body: ArrayBuffer | Buffer, contentType: string): NextResponse {
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
    });
  }
}
