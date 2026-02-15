/**
 * Navigation utility functions for path matching and normalization
 */

export function normalizeNavPath(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('#group-')) return '';
  const withoutQuery = raw.split('?')[0] || '';
  const withoutHash = withoutQuery.split('#')[0] || '';
  if (!withoutHash.startsWith('/')) return `/${withoutHash}`;
  return withoutHash !== '/' ? withoutHash.replace(/\/+$/, '') : '/';
}

export function isPathMatch(pathname: string, itemPath?: string): boolean {
  const current = normalizeNavPath(pathname);
  const target = normalizeNavPath(itemPath);
  if (!target) return false;
  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}

export function resolveBestMatchPath(pathname: string, paths: string[]): string | null {
  const normalized = Array.from(
    new Set(paths.map((entry) => normalizeNavPath(entry)).filter(Boolean))
  ) as string[];
  const matches = normalized.filter((entry) => isPathMatch(pathname, entry));
  if (!matches.length) return null;
  matches.sort((a, b) => b.length - a.length);
  return matches[0] || null;
}

export function isPathActive(pathname: string, itemPath?: string, candidatePaths: string[] = []): boolean {
  const target = normalizeNavPath(itemPath);
  if (!target) return false;
  if (!candidatePaths.length) return isPathMatch(pathname, target);
  return resolveBestMatchPath(pathname, candidatePaths) === target;
}
