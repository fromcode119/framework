import { BaseService } from './base-service';

/**
 * Menu Service.
 * 
 * Provides utilities for menu manipulation, normalization, and deduplication.
 * 
 * @example
 * ```typescript
 * import { CoreServices } from '@fromcode119/core';
 * 
 * const services = CoreServices.getInstance();
 * const path = services.menu.normalizePath('/admin/settings/');
 * const deduped = services.menu.deduplicate(menuItems);
 * ```
 */
export class MenuService extends BaseService {
  get serviceName(): string {
    return 'MenuService';
  }

  /**
   * Normalizes a menu group key.
   * 
   * @param value - Raw group key
   * @param fallback - Fallback value if empty
   * @returns Normalized lowercase group key
   */
  normalizeGroupKey(value?: string, fallback = 'management'): string {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    return raw.toLowerCase();
  }

  /**
   * Normalizes a menu path.
   * - Ensures leading slash
   * - Removes trailing slashes (except root "/")
   * - Converts to lowercase
   * 
   * @param value - Raw menu path
   * @returns Normalized path
   */
  normalizePath(value?: any): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw === '/') return '/';
    return raw.replace(/\/+$/, '').toLowerCase();
  }

  /**
   * Recursively collects all paths from a menu item and its children.
   * 
   * @param item - Menu item with optional children array
   * @returns Flat array of all paths
   */
  getNestedPaths(item: any): string[] {
    const paths: string[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      const path = String(node.path || '').trim();
      if (path) paths.push(path);
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach((child: any) => walk(child));
    };
    walk(item);
    return paths;
  }

  /**
   * De-duplicates a list of menu items.
   * 
   * Removes:
   * 1. Duplicate child routes
   * 2. Top-level routes already represented as children
   * 3. Duplicate top-level routes by normalized path
   * 
   * @param items - Array of menu items
   * @returns De-duplicated menu items
   */
  deduplicate(items: any[]): any[] {
    const nestedPaths = new Set<string>();

    // Deduplicate children
    const withDedupedChildren = items.map((item) => {
      if (!Array.isArray(item.children) || item.children.length === 0) return item;
      const seenChildPaths = new Set<string>();
      const children = item.children.filter((child: any) => {
        const key = this.normalizePath(child?.path);
        if (!key) return true;
        if (seenChildPaths.has(key)) return false;
        seenChildPaths.add(key);
        nestedPaths.add(key);
        return true;
      });
      return { ...item, children };
    });

    // Deduplicate top-level
    const seenTopLevelPaths = new Set<string>();
    return withDedupedChildren.filter((item) => {
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;
      const key = this.normalizePath(item.path);
      if (!key) return true;
      
      // Remove if it's a child elsewhere
      if (!hasChildren && nestedPaths.has(key)) return false;
      
      // Remove if duplicate top-level
      if (seenTopLevelPaths.has(key)) return false;
      seenTopLevelPaths.add(key);
      return true;
    });
  }
}