export function normalizeRequestPath(path: string): string {
  if (!path) return '/';
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/api/')) return normalized;
  const version = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
  return `/api/${version}${normalized}`;
}
