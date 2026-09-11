import type { NextRequest, NextResponse } from 'next/server';
import { AdminProxy } from '@/lib/admin-proxy';

/**
 * Next.js middleware entry for admin authentication — the authored source.
 *
 * All behaviour lives in `AdminProxy` (lib/admin-proxy.ts). Next needs a `proxy` function and a `config`
 * object as module EXPORTS, neither of which a class can be; next-build-codegen's `MiddlewareGlueGenerator` writes
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
   * - internal (server-to-server endpoints — see below)
   * - favicon.ico (favicon file)
   * - robots.txt (must answer a crawler, which has no session — the gate was redirecting it to
   *   /login, so the file could never be read by the only thing that asks for it)
   * - Global JS/CSS and assets (Common file extensions, incl. .webmanifest so the
   *   PWA manifest is readable pre-login and the install prompt works from the login page;
   *   sw.js and /brand/*.png are already covered by the .js / .png extensions)
   *
   * `internal` is excluded because this gate is a BROWSER SESSION gate: no cookie means redirect to
   * /login. The api calls `/internal/*` as a process, with the shared internal secret and no cookie,
   * so the gate turned every one of those calls into a 307 to the login page — which then answered
   * the POST with 405. Those routes are NOT unguarded: each verifies `InternalServiceAuth` itself and
   * fails closed when the deployment has no secret, which is a stronger check than a session cookie.
   */
  static readonly config = {
    matcher: [
      '/((?!api|_next/static|_next/image|_next/webpack-hmr|icons-registry|internal|favicon.ico|robots.txt|.*\\.(?:js|css|json|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf|webmanifest)).*)',
    ],
  };
}
