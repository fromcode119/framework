const MENU_GROUP_CONFIG: Record<string, { label: string; order: number; manual?: boolean }> = {
  core: { label: 'Core', order: 0 },
  management: { label: 'Management', order: 1 },
  settings: { label: 'Settings', order: 98, manual: true },
  system: { label: 'System', order: 99, manual: true },
};

/**
 * Navigation path matching and menu utilities.
 *
 * @example
 * NavUtils.normalizePath('/admin/settings/')    // "/admin/settings"
 * NavUtils.isPathMatch('/admin/users', '/admin') // true
 * NavUtils.isPathActive('/admin/settings', '/settings', ['/settings', '/users'])
 */
export class NavUtils {
  static normalizePath(value?: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.includes('#group-')) return '';
    const withoutQuery = raw.split('?')[0] || '';
    const withoutHash = withoutQuery.split('#')[0] || '';
    if (!withoutHash.startsWith('/')) return `/${withoutHash}`;
    return withoutHash !== '/' ? withoutHash.replace(/\/+$/, '') : '/';
  }

  static isPathMatch(pathname: string, itemPath?: string): boolean {
    const current = NavUtils.normalizePath(pathname);
    const target = NavUtils.normalizePath(itemPath);
    if (!target) return false;
    if (target === '/') return current === '/';
    return current === target || current.startsWith(`${target}/`);
  }

  static resolveBestMatchPath(pathname: string, paths: string[]): string | null {
    const normalized = Array.from(
      new Set(paths.map((entry) => NavUtils.normalizePath(entry)).filter(Boolean))
    ) as string[];
    const matches = normalized.filter((entry) => NavUtils.isPathMatch(pathname, entry));
    if (!matches.length) return null;
    matches.sort((a, b) => b.length - a.length);
    return matches[0] || null;
  }

  static resolveBestMatchEntry<T extends { path?: string }>(pathname: string, entries: T[]): T | null {
    const normalizedEntries = (entries || []).filter((entry) => NavUtils.normalizePath(entry?.path));
    const bestPath = NavUtils.resolveBestMatchPath(pathname, normalizedEntries.map((entry) => String(entry.path || '')));
    if (!bestPath) {
      return null;
    }

    return normalizedEntries.find((entry) => NavUtils.normalizePath(entry.path) === bestPath) || null;
  }

  static isPathActive(pathname: string, itemPath?: string, candidatePaths: string[] = []): boolean {
    const target = NavUtils.normalizePath(itemPath);
    if (!target) return false;
    if (!candidatePaths.length) return NavUtils.isPathMatch(pathname, target);
    return NavUtils.resolveBestMatchPath(pathname, candidatePaths) === target;
  }

  static normalizeGroupKey(value?: string, fallback = 'management'): string {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    return raw.toLowerCase();
  }

  static getMenuGroupMeta(groupKey?: string): { key: string; label: string; order: number; manual?: boolean } {
    const normalized = NavUtils.normalizeGroupKey(groupKey);
    const configured = MENU_GROUP_CONFIG[normalized];
    if (configured) return { key: normalized, ...configured };
    const label = String(normalized || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { key: normalized, label, order: Number.MAX_SAFE_INTEGER, manual: false };
  }

  static sortMenuGroups(groups: string[]): string[] {
    return [...groups].sort((a, b) => {
      const aMeta = NavUtils.getMenuGroupMeta(a);
      const bMeta = NavUtils.getMenuGroupMeta(b);
      if (aMeta.order !== bMeta.order) return aMeta.order - bMeta.order;
      return aMeta.key.localeCompare(bMeta.key);
    });
  }

  static normalizeMenuPath(value?: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw === '/') return '/';
    return raw.replace(/\/+$/, '').toLowerCase();
  }

  static deduplicateMenuItems(items: any[]): any[] {
    const nestedPaths = new Set<string>();
    const withDedupedChildren = items.map((item) => {
      if (!Array.isArray(item.children) || item.children.length === 0) return item;
      const seenChildPaths = new Set<string>();
      const children = item.children.filter((child: any) => {
        const key = NavUtils.normalizeMenuPath(child?.path);
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
      const key = NavUtils.normalizeMenuPath(item.path);
      if (!key) return true;
      if (!hasChildren && nestedPaths.has(key)) return false;
      if (seenTopLevelPaths.has(key)) return false;
      seenTopLevelPaths.add(key);
      return true;
    });
  }
}