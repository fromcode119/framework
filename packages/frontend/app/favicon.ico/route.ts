import { NextResponse } from 'next/server';
import { ThemeFaviconRouteResolver } from '@/lib/theme/theme-favicon-route-resolver';
import { ServerApiUtils } from '@/lib/server-api';

export async function GET(request: Request) {
  try {
    const resolvedIcon = await ThemeFaviconRouteResolver.resolve();

    for (const assetPath of resolvedIcon.themeAssetPaths) {
      const assetResponse = await ServerApiUtils.serverFetchInternalResponse(assetPath);
      if (!assetResponse?.ok) {
        continue;
      }

      return new NextResponse(await assetResponse.arrayBuffer(), {
        status: 200,
        headers: {
          'Content-Type': assetResponse.headers.get('content-type') || 'image/x-icon',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const fallbackUrl = new URL(resolvedIcon.frameworkFallbackPath, request.url);
    const fallbackResponse = await fetch(fallbackUrl, { cache: 'no-store' });
    if (fallbackResponse.ok) {
      return new NextResponse(await fallbackResponse.arrayBuffer(), {
        status: 200,
        headers: {
          'Content-Type': fallbackResponse.headers.get('content-type') || 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[frontend/favicon] Failed to serve favicon:', error);
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
}
