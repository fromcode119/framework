import { RouteConstants } from '@fromcode119/core/client';

const RAW_ADMIN_BASE_PATH = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '';

/**
 * Admin path resolution utilities.
 *
 * @example
 * AdminPathUtils.basePath()                        // "/admin"
 * AdminPathUtils.stripBase('/admin/plugins')       // "/plugins"
 * AdminPathUtils.toAdminPath('/settings')          // "/admin/settings"
 */
export class AdminPathUtils {
  static basePath(): string {
    const configured = AdminPathUtils.normalizeBasePath(RAW_ADMIN_BASE_PATH);
    if (configured) return configured;
    return AdminPathUtils.inferAdminBasePathFromWindow();
  }

  static stripBase(pathname: string): string {
    const safe = pathname || '/';
    const base = AdminPathUtils.basePath();
    if (!base) return safe;
    if (safe === base) return '/';
    if (safe.startsWith(`${base}/`)) return safe.slice(base.length) || '/';
    return safe;
  }

  static resolveCatchAll(pathSegments: string[]): { pathname: string; segments: string[] } {
    const segs = Array.isArray(pathSegments) ? pathSegments.filter(Boolean) : [];
    const rawPathname = `/${segs.join('/')}`;
    const normalizedPathname = AdminPathUtils.stripBase(rawPathname);
    const normalizedSegments = normalizedPathname.split('/').filter(Boolean);
    const segments = normalizedSegments.length > 0 ? normalizedSegments : segs;
    return { pathname: `/${segments.join('/')}`, segments };
  }

  static toAdminPath(path: string): string {
    const safeInput = path || '/';
    const queryIndex = safeInput.indexOf('?');
    const hashIndex = safeInput.indexOf('#');
    let splitIndex = -1;
    if (queryIndex >= 0 && hashIndex >= 0) {
      splitIndex = Math.min(queryIndex, hashIndex);
    } else {
      splitIndex = Math.max(queryIndex, hashIndex);
    }
    const rawPath = splitIndex >= 0 ? safeInput.slice(0, splitIndex) : safeInput;
    const suffix = splitIndex >= 0 ? safeInput.slice(splitIndex) : '';
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const base = AdminPathUtils.basePath();
    if (!base) return `${normalizedPath}${suffix}`;
    if (normalizedPath === '/') return `${base}/${suffix}`;
    return `${base}${normalizedPath}${suffix}`;
  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static normalizeBasePath(value: string): string {
    if (!value || value === '/') return '';
    const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
    return withLeadingSlash.replace(/\/+$/, '');
  }

  private static inferAdminBasePathFromWindow(): string {
    if (typeof window === 'undefined') return '';
    const pathname = window.location.pathname || '';
    // Use centralized constant instead of hardcoded string
    const defaultBase = RouteConstants.SEGMENTS.ADMIN_BASE;
    if (pathname === defaultBase || pathname.startsWith(`${defaultBase}/`)) return defaultBase;
    return '';
  }
}