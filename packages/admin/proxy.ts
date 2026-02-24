import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROUTES } from '@/lib/constants';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('fc_token')?.value;
  const pathname = request.nextUrl.pathname;
  const publicAuthRoutes = new Set<string>(ROUTES.AUTH.PUBLIC as readonly string[]);
  const isLoginPage = pathname === ROUTES.AUTH.LOGIN;
  const isSetupPage = pathname === ROUTES.AUTH.SETUP;
  const isPublicAuthPage = publicAuthRoutes.has(pathname);

  // Allow setup page always to prevent loops during fresh installs
  if (isSetupPage) {
    return NextResponse.next();
  }

  // If no token and not on auth pages, redirect to login
  if (!token && !isPublicAuthPage) {
    const loginUrl = new URL(ROUTES.AUTH.LOGIN, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If token and on login page, redirect to dashboard
  if (token && isLoginPage) {
    const dashboardUrl = new URL(ROUTES.ROOT, request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
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
