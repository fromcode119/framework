import { AdminConstants } from '@/lib/constants';
import { NavUtils } from '@/lib/nav-utils';

/**
 * Pure menu-grouping + active-context resolution helpers for the admin Sidebar.
 * Extracted verbatim from the component so the hooks stay in the component while the
 * branchy logic lives in one testable place. No React, no side effects.
 */
export class SidebarMenuService {
  static readonly adminProtectedPaths: string[] = [
    AdminConstants.ROUTES.ROOT,
    AdminConstants.ROUTES.PLUGINS.ROOT,
    AdminConstants.ROUTES.USERS.ROOT,
    AdminConstants.ROUTES.SETTINGS.ROOT,
    AdminConstants.ROUTES.MEDIA.ROOT,
    AdminConstants.ROUTES.USERS.ROLE_LIST,
    AdminConstants.ROUTES.USERS.PERMISSIONS,
    AdminConstants.ROUTES.ACTIVITY,
  ];

  static readonly coreGroupPaths: string[] = [
    AdminConstants.ROUTES.ROOT,
    AdminConstants.ROUTES.USERS.ROOT,
    AdminConstants.ROUTES.MEDIA.ROOT,
  ];

  static readonly managementGroupPaths: string[] = [
    AdminConstants.ROUTES.PLUGINS.ROOT,
    AdminConstants.ROUTES.THEMES.ROOT,
  ];

  static authorizeMenuItems(menuItems: any[], user: any): any[] {
    // Filter out items the user shouldn't see. For now, only 'admin' can see
    // platform/system routes. In the future, this will be more granular.
    return menuItems.filter(item => {
      const isAdminRoute = SidebarMenuService.adminProtectedPaths.some(path => item.path === path || item.path?.startsWith(path + '/'));
      if (isAdminRoute && !user?.roles?.includes('admin')) {
        return false;
      }
      return true;
    });
  }

  static resolveGroupKey(itemPath: string, rawGroup: string): string {
    if (SidebarMenuService.coreGroupPaths.includes(itemPath)) return 'core';
    if (SidebarMenuService.managementGroupPaths.includes(itemPath)) return 'management';
    if (itemPath === AdminConstants.ROUTES.ACTIVITY) return 'system';
    return rawGroup;
  }

  static buildGroupedMenu(groupedMenuItems: any[]): { groupedMenu: Record<string, any[]>; groupLabels: Record<string, string> } {
    // groupLabels preserves the original casing from the collection definition so that
    // "E-commerce" is not lowercased to "e-commerce" in the sidebar header.
    const groupLabels: Record<string, string> = {};
    const groupedMenu = groupedMenuItems.reduce((acc: Record<string, any[]>, item) => {
      const rawGroup = NavUtils.normalizeGroupKey(item.group);
      const originalLabel = String(item.group || '').trim();
      const groupKey = SidebarMenuService.resolveGroupKey(item.path, rawGroup);

      // First item in this group wins the display label (all items in a group should have
      // the same casing). Built-in groups keep their configured label; plugin/theme groups
      // use the original casing so "E-commerce" is not lowercased to "e-commerce".
      if (!groupLabels[groupKey] && originalLabel) {
        const configured = NavUtils.getMenuGroupMeta(groupKey);
        const isBuiltIn = ['core', 'management', 'settings', 'system'].includes(groupKey);
        groupLabels[groupKey] = isBuiltIn ? configured.label : originalLabel;
      }

      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {});

    return { groupedMenu, groupLabels };
  }

  static sortGroups(groupedMenu: Record<string, any[]>): string[] {
    return NavUtils.sortMenuGroups(Object.keys(groupedMenu))
      .filter((groupKey) => !NavUtils.getMenuGroupMeta(groupKey).manual);
  }

  static resolvePrimaryContextId(authorizedMenuItems: any[], pathname: string): string {
    const normalizedPath = NavUtils.normalizePath(pathname);
    if (!normalizedPath) return '';

    const entries: Array<{ path: string; pluginSlug: string }> = [];
    for (const item of authorizedMenuItems) {
      const itemPath = NavUtils.normalizePath(item.path);
      if (itemPath) {
        entries.push({ path: itemPath, pluginSlug: String(item.pluginSlug || '').trim().toLowerCase() });
      }

      for (const child of item.children || []) {
        const childPath = NavUtils.normalizePath(child.path);
        if (!childPath) continue;
        entries.push({
          path: childPath,
          pluginSlug: String(child.pluginSlug || item.pluginSlug || '').trim().toLowerCase(),
        });
      }
    }

    const bestPath = NavUtils.resolveBestMatchPath(normalizedPath, entries.map((entry) => entry.path));
    if (!bestPath) return '';

    const match = entries.find((entry) => entry.path === bestPath);
    return String(match?.pluginSlug || '');
  }

  static resolveActiveGroupKey(activeTopLevelItem: any): string {
    const normalizedGroup = NavUtils.normalizeGroupKey(activeTopLevelItem?.group);
    const path = String(activeTopLevelItem?.path || '');
    if (SidebarMenuService.coreGroupPaths.includes(path)) return 'core';
    if (SidebarMenuService.managementGroupPaths.includes(path)) return 'management';
    if (path === AdminConstants.ROUTES.ACTIVITY) return 'system';
    return normalizedGroup;
  }
}
