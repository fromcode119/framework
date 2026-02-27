const RAW_ADMIN_BASE_PATH = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '';

function normalizeBasePath(value: string): string {
  if (!value || value === '/') return '';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function inferAdminBasePathFromWindow(): string {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname || '';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return '/admin';
  return '';
}

export function resolveAdminBasePath(): string {
  const configuredBasePath = normalizeBasePath(RAW_ADMIN_BASE_PATH);
  if (configuredBasePath) return configuredBasePath;
  return inferAdminBasePathFromWindow();
}

export function stripAdminBasePath(pathname: string): string {
  const safePathname = pathname || '/';
  const basePath = resolveAdminBasePath();

  if (!basePath) return safePathname;
  if (safePathname === basePath) return '/';
  if (safePathname.startsWith(`${basePath}/`)) {
    return safePathname.slice(basePath.length) || '/';
  }
  return safePathname;
}

export function resolveCatchAllAdminPath(pathSegments: string[]): { pathname: string; segments: string[] } {
  const safeSegments = Array.isArray(pathSegments) ? pathSegments.filter(Boolean) : [];
  const rawPathname = `/${safeSegments.join('/')}`;
  const normalizedPathname = stripAdminBasePath(rawPathname);
  const normalizedSegments = normalizedPathname.split('/').filter(Boolean);
  const segments = normalizedSegments.length > 0 ? normalizedSegments : safeSegments;
  return {
    pathname: `/${segments.join('/')}`,
    segments
  };
}

export function toAdminPath(path: string): string {
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
  const basePath = resolveAdminBasePath();

  if (!basePath) return `${normalizedPath}${suffix}`;
  if (normalizedPath === '/') return `${basePath}/${suffix}`;
  return `${basePath}${normalizedPath}${suffix}`;
}
