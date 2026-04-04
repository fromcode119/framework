import { NavUtils } from '@/lib/nav-utils';
import type { MenuItem, SecondaryPanelItem } from '@fromcode119/react';
import type { SecondarySidebarResolveInput, SecondarySidebarResolveResult } from './secondary-sidebar-context-resolver.interfaces';

const EMPTY_RESULT: SecondarySidebarResolveResult = { activeContextId: '', activeContext: null, activeSourcePath: '', items: [] };

export class SecondarySidebarContextResolver {
  resolve(input: SecondarySidebarResolveInput): SecondarySidebarResolveResult {
    if (!input.secondaryPanel?.contexts) {
      return EMPTY_RESULT;
    }

    const activeMenuEntry = this.resolveFromPath(input.pathname, input.menuItems);
    const contextId = this.resolveContextId(input);
    const contextualItems = contextId ? (input.secondaryPanel.itemsByContext[contextId] || []) : [];
    const routeItems = [...contextualItems, ...(input.secondaryPanel.globalItems || [])];
    const activeSourcePath = this.resolveActiveSourcePath(routeItems, input.pathname, activeMenuEntry?.path || '');
    const routeScopedItems = this.filterBySourcePaths(routeItems, input.pathname, activeSourcePath);
    const items = this.filterAccessibleItems(routeScopedItems, input.userRoles, input.userCapabilities);

    return {
      activeContextId: contextId,
      activeContext: contextId ? input.secondaryPanel.contexts[contextId] || null : null,
      activeSourcePath,
      items,
    };
  }

  private resolveContextId(input: SecondarySidebarResolveInput): string {
    const fromPrimary = this.resolveFromPrimaryContext(input.primaryContextId, input.secondaryPanel.contexts);
    if (fromPrimary) {
      return fromPrimary;
    }

    const fromPath = this.resolveFromPath(input.pathname, input.menuItems);
    const pluginSlug = this.resolvePathPluginSlug(input.pathname, fromPath?.pluginSlug || '');
    if (!pluginSlug) {
      return '';
    }

    const directContextMatch = Object.values(input.secondaryPanel.contexts).find((entry) => entry.targetPlugin === pluginSlug);
    if (directContextMatch?.id) {
      return String(directContextMatch.id);
    }

    const pluginCanonicalKey = this.resolvePluginCanonicalKey(pluginSlug, input.plugins);
    if (pluginCanonicalKey && input.secondaryPanel.contexts[pluginCanonicalKey]) {
      return pluginCanonicalKey;
    }

    return '';
  }

  private resolvePathPluginSlug(pathname: string, pathPluginSlug: string): string {
    const normalizedPathPluginSlug = String(pathPluginSlug || '').trim().toLowerCase();
    if (normalizedPathPluginSlug) {
      return normalizedPathPluginSlug;
    }

    const normalizedPath = NavUtils.normalizePath(pathname);
    if (!normalizedPath) {
      return '';
    }

    const segment = normalizedPath.split('/').filter(Boolean)[0] || '';
    return String(segment).trim().toLowerCase();
  }

  private resolveFromPrimaryContext(primaryContextId: string, contexts: Record<string, any>): string {
    const normalized = String(primaryContextId || '').trim().toLowerCase();
    if (!normalized) {
      return '';
    }

    if (contexts[normalized]) {
      return normalized;
    }

    const match = Object.values(contexts).find((context: any) => context.targetPlugin === normalized);
    return String(match?.id || '');
  }

  private resolveFromPath(pathname: string, menuItems: MenuItem[]): { pluginSlug: string; path: string } | null {
    const flattened = this.flattenMenu(menuItems);
    const bestPath = NavUtils.resolveBestMatchPath(pathname, flattened.map((entry) => entry.path));
    if (!bestPath) {
      return null;
    }

    return flattened.find((entry) => entry.path === bestPath) || null;
  }

  private flattenMenu(menuItems: MenuItem[]): Array<{ pluginSlug: string; path: string }> {
    const entries: Array<{ pluginSlug: string; path: string }> = [];

    for (const item of menuItems || []) {
      const itemPath = NavUtils.normalizePath(item?.path);
      if (itemPath) {
        entries.push({ pluginSlug: String(item?.pluginSlug || '').trim().toLowerCase(), path: itemPath });
      }

      for (const child of item?.children || []) {
        const childPath = NavUtils.normalizePath(child?.path);
        if (!childPath) {
          continue;
        }
        entries.push({
          pluginSlug: String(child?.pluginSlug || item?.pluginSlug || '').trim().toLowerCase(),
          path: childPath,
        });
      }
    }

    return entries;
  }

  private resolvePluginCanonicalKey(pluginSlug: string, plugins: any[]): string {
    const normalizedPluginSlug = String(pluginSlug || '').trim().toLowerCase();
    if (!normalizedPluginSlug) {
      return '';
    }

    const plugin = (plugins || []).find((entry) => String(entry?.slug || '').trim().toLowerCase() === normalizedPluginSlug);
    const namespace = String(plugin?.namespace || '').trim().toLowerCase();
    const slug = String(plugin?.slug || '').trim().toLowerCase();
    if (!namespace || !slug) {
      return '';
    }

    return `${namespace}:${slug}`;
  }

  private filterAccessibleItems(items: SecondaryPanelItem[], userRoles: string[], userCapabilities: string[]): SecondaryPanelItem[] {
    const normalizedRoles = new Set((userRoles || []).map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean));
    const normalizedCapabilities = new Set((userCapabilities || []).map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean));

    return items.filter((item) => {
      const requiredRoles = (item.requiredRoles || []).map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
      const requiredCapabilities = (item.requiredCapabilities || []).map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
      const roleAllowed = !requiredRoles.length || requiredRoles.some((entry) => normalizedRoles.has(entry));
      const capabilityAllowed = !requiredCapabilities.length || requiredCapabilities.every((entry) => normalizedCapabilities.has(entry));
      return roleAllowed && capabilityAllowed;
    });
  }

  private resolveActiveSourcePath(items: SecondaryPanelItem[], pathname: string, activeMenuPath: string): string {
    const normalizedActiveMenuPath = NavUtils.normalizePath(activeMenuPath);
    const matchedSecondaryItem = NavUtils.resolveBestMatchEntry(pathname, items);
    if (!matchedSecondaryItem) {
      return normalizedActiveMenuPath;
    }

    const sourcePaths = (matchedSecondaryItem.sourcePaths || []).map((entry) => NavUtils.normalizePath(entry)).filter(Boolean);
    if (!sourcePaths.length) {
      return normalizedActiveMenuPath;
    }

    if (normalizedActiveMenuPath && sourcePaths.includes(normalizedActiveMenuPath)) {
      return normalizedActiveMenuPath;
    }

    return sourcePaths[0] || normalizedActiveMenuPath;
  }

  private filterBySourcePaths(items: SecondaryPanelItem[], pathname: string, activeMenuPath: string): SecondaryPanelItem[] {
    const normalizedActiveMenuPath = NavUtils.normalizePath(activeMenuPath);

    return items.filter((item) => {
      const sourcePaths = (item.sourcePaths || []).map((entry) => NavUtils.normalizePath(entry)).filter(Boolean);
      if (!sourcePaths.length) {
        return true;
      }

      if (normalizedActiveMenuPath) {
        return sourcePaths.includes(normalizedActiveMenuPath);
      }

      return sourcePaths.some((entry) => NavUtils.isPathMatch(pathname, entry));
    });
  }
}
