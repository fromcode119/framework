import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { ThemeFaviconRouteResolver } from '@/lib/theme/theme-favicon-route-resolver';

export async function GET() {
  const resolvedIcon = await ThemeFaviconRouteResolver.resolve();
  if (!resolvedIcon) {
    return new NextResponse(null, { status: 404 });
  }
  const icon = await readFile(resolvedIcon.filePath);

  return new NextResponse(icon, {
    status: 200,
    headers: {
      'Content-Type': resolvedIcon.contentType,
      'Cache-Control': 'public, max-age=86400',
    }
  });
}
