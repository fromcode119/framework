import { buildApiVersionPrefix } from '@fromcode119/sdk';

export function normalizeRequestPath(path: string): string {
  if (!path) return '/';
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/api/')) return normalized;
  return `${buildApiVersionPrefix()}${normalized}`;
}
