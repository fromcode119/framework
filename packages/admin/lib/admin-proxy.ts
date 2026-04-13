import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ApplicationUrlUtils, CookieConstants } from '@fromcode119/core/client';
import { AdminConstants } from './constants';

/**
 * AdminProxy - Business logic for admin authentication middleware
 * Handles admin access verification and path normalization
 */
export class AdminProxy {
  static handle(request: NextRequest): NextResponse {
    const token = request.cookies.get(CookieConstants.AUTH_TOKEN)?.value;
    const basePath = AdminProxy.resolveBasePath(request);
    const pathname = AdminProxy.stripBasePath(request.nextUrl.pathname, basePath);
    const publicAuthRoutes = new Set<string>(AdminConstants.ROUTES.AUTH.PUBLIC as readonly string[]);

    const redirectTo = (route: string): NextResponse => {
      const url = request.nextUrl.clone();
      // In Next middleware, pathname must be basePath-relative.
      // Setting "/admin/..." when basePath="/admin" would cause "/admin/admin/...".
      url.pathname = route.startsWith('/') ? route : `/${route}`;
      url.search = '';
      return NextResponse.redirect(url);
    };

    // Allow setup page always to prevent loops during fresh installs
    if (pathname === AdminConstants.ROUTES.AUTH.SETUP) {
      return NextResponse.next();
    }

    // If no token and not on a public auth page, redirect to login
    if (!token && !publicAuthRoutes.has(pathname)) {
      return redirectTo(AdminConstants.ROUTES.AUTH.LOGIN);
    }

    // Keep login reachable even when a stale/invalid token cookie exists.
    // The client auth flow decides whether to continue to dashboard or prompt re-auth.
    if (pathname === AdminConstants.ROUTES.AUTH.LOGIN) {
      return NextResponse.next();
    }

    return NextResponse.next();
  }

  private static normalizeBasePath(value: string): string {
    if (!value || value === '/') return '';
    const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
    return withLeadingSlash.replace(/\/+$|\/+$/g, '').replace(/\/+/g, '/');
  }

  private static resolveBasePath(request: NextRequest): string {
    const envBasePath = ApplicationUrlUtils.readAppBasePathFromEnvironment(ApplicationUrlUtils.ADMIN_APP)
      || AdminProxy.normalizeBasePath(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '');
    if (envBasePath) return envBasePath;

    const configuredBasePath = AdminProxy.normalizeBasePath(request.nextUrl.basePath || '');
    if (configuredBasePath) return configuredBasePath;

    const rawPathname = request.nextUrl.pathname || '';
    if (rawPathname === AdminConstants.ROUTES.ADMIN.BASE || rawPathname.startsWith(`${AdminConstants.ROUTES.ADMIN.BASE}/`)) {
      return AdminConstants.ROUTES.ADMIN.BASE;
    }

    return '';
  }

  private static stripBasePath(pathname: string, basePath: string): string {
    if (!basePath) return pathname || '/';
    if (pathname === basePath) return '/';
    if (pathname.startsWith(`${basePath}/`)) {
      return pathname.slice(basePath.length) || '/';
    }
    return pathname || '/';
  }
}
