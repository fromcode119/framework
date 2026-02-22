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

export function normalizeGroupKey(value?: string, fallback = 'management'): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.toLowerCase();
}

export function normalizeMenuPath(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === '/') return '/';
  return raw.replace(/\/+$/, '').toLowerCase();
}

/**
 * De-duplicates a list of menu items.
 * Centralized logic that removes redundant paths and handles nested child de-duplication.
 */
export function deduplicateMenuItems(items: any[]): any[] {
  const nestedPaths = new Set<string>();

  const withDedupedChildren = items.map((item) => {
    if (!Array.isArray(item.children) || item.children.length === 0) return item;
    const seenChildPaths = new Set<string>();
    const children = item.children.filter((child: any) => {
      const key = normalizeMenuPath(child?.path);
      if (!key) return true;
      if (seenChildPaths.has(key)) return false;
      seenChildPaths.add(key);
      nestedPaths.add(key);
      return true;
    });
    return { ...item, children };
  });

  const seenTopLevelPaths = new Set<string>();
  return withDedupedChildren.filter((item) => {
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const key = normalizeMenuPath(item.path);
    if (!key) return true;
    if (!hasChildren && nestedPaths.has(key)) return false;
    if (seenTopLevelPaths.has(key)) return false;
    seenTopLevelPaths.add(key);
    return true;
  });
}
