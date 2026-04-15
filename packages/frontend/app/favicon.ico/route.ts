import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { ThemeFaviconRouteResolver } from '@/lib/theme/theme-favicon-route-resolver';

export async function GET() {
  try {
    const resolvedIcon = await ThemeFaviconRouteResolver.resolve();
    if (!resolvedIcon) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const icon = await readFile(resolvedIcon.filePath);

    return new NextResponse(icon, {
      status: 200,
      headers: {
        'Content-Type': resolvedIcon.contentType,
        'Cache-Control': 'public, max-age=86400',
      }
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
