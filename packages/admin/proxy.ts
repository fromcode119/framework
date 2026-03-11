import type { NextRequest, NextResponse } from 'next/server';
import { AdminProxy } from '@/lib/admin-proxy';

/**
 * Next.js middleware entry point for admin authentication.
 * All business logic is in AdminProxy class (see lib/admin-proxy.ts).
 * This file contains only the framework-required exports.
 */
export function proxy(request: NextRequest): NextResponse {
  return AdminProxy.handle(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack-hmr (hot module replacement)
     * - icons-registry (framework internal icons)
     * - favicon.ico (favicon file)
     * - Global JS/CSS and assets (Common file extensions)
     */
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|icons-registry|favicon.ico|.*\\.(?:js|css|json|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf)).*)',
  ],
};