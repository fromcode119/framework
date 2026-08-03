import type { NextRequest, NextResponse } from 'next/server';
import { AdminProxy } from '@/lib/admin-proxy';

/**
 * Next.js middleware entry for admin authentication — the authored source.
 *
 * All behaviour lives in `AdminProxy` (lib/admin-proxy.ts). Next needs a `proxy` function and a `config`
 * object as module EXPORTS, neither of which a class can be; nextor's `MiddlewareGlueGenerator` writes
 * `proxy.ts` from these statics before the build. Nothing here is hand-written glue.
 */
export class AdminProxyRoute {
  static proxy(request: NextRequest): NextResponse {
    return AdminProxy.handle(request);
  }

  /*
   * Match all request paths except for the ones starting with:
   * - api (API routes)
   * - _next/static (static files)
   * - _next/image (image optimization files)
   * - _next/webpack-hmr (hot module replacement)
   * - icons-registry (framework internal icons)
   * - favicon.ico (favicon file)
   * - Global JS/CSS and assets (Common file extensions, incl. .webmanifest so the
   *   PWA manifest is readable pre-login and the install prompt works from the login page;
   *   sw.js and /brand/*.png are already covered by the .js / .png extensions)
   */
  static readonly config = {
    matcher: [
      '/((?!api|_next/static|_next/image|_next/webpack-hmr|icons-registry|favicon.ico|.*\\.(?:js|css|json|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf|webmanifest)).*)',
    ],
  };
}
