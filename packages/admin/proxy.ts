import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROUTES } from '@/lib/constants';

function normalizeBasePath(value: string): string {
  if (!value || value === '/') return '';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$|\/+$/g, '').replace(/\/+/g, '/');
}

function resolveAdminBasePath(request: NextRequest): string {
  const envBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '');
  if (envBasePath) return envBasePath;

  const configuredBasePath = normalizeBasePath(request.nextUrl.basePath || '');
  if (configuredBasePath) return configuredBasePath;

  const rawPathname = request.nextUrl.pathname || '';
  if (rawPathname === '/admin' || rawPathname.startsWith('/admin/')) {
    return '/admin';
  }

  return '';
}

function stripBasePath(pathname: string, basePath: string): string {
  if (!basePath) return pathname || '/';
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || '/';
  }
  return pathname || '/';
}

function withBasePath(route: string, basePath: string): string {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  if (!basePath) return normalizedRoute;
  if (normalizedRoute === '/') return `${basePath}/`;
  return `${basePath}${normalizedRoute}`;
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get('fc_token')?.value;
  const basePath = resolveAdminBasePath(request);
  const pathname = stripBasePath(request.nextUrl.pathname, basePath);
  const publicAuthRoutes = new Set<string>(ROUTES.AUTH.PUBLIC as readonly string[]);
  const isLoginPage = pathname === ROUTES.AUTH.LOGIN;
  const isSetupPage = pathname === ROUTES.AUTH.SETUP;
  const isPublicAuthPage = publicAuthRoutes.has(pathname);

  const redirectTo = (route: string) => {
    const url = request.nextUrl.clone();
    url.pathname = withBasePath(route, basePath);
    url.search = '';
    return NextResponse.redirect(url);
  };

  // Allow setup page always to prevent loops during fresh installs
  if (isSetupPage) {
    return NextResponse.next();
  }

  // If no token and not on auth pages, redirect to login
  if (!token && !isPublicAuthPage) {
    return redirectTo(ROUTES.AUTH.LOGIN);
  }

  // Keep login reachable even when a stale/invalid token cookie exists.
  // The client auth flow will decide whether to continue to dashboard or prompt re-auth.
  if (isLoginPage) {
    return NextResponse.next();
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
