import { AdminConstants } from '@/lib/constants/admin.constants';
import { NavUtils } from '@/lib/nav-utils';
import { PermissionGrants } from '@fromcode119/core/utils/permission-grants';

/**
 * Pure menu-grouping + active-context resolution helpers for the admin Sidebar.
 * Extracted verbatim from the component so the hooks stay in the component while the
 * branchy logic lives in one testable place. No React, no side effects.
 */
export class SidebarMenuService {
  static readonly coreGroupPaths: string[] = [
    AdminConstants.ROUTES.ROOT,
    AdminConstants.ROUTES.USERS.ROOT,
    AdminConstants.ROUTES.MEDIA.ROOT,
  ];

  static readonly managementGroupPaths: string[] = [
    AdminConstants.ROUTES.PLUGINS.ROOT,
    AdminConstants.ROUTES.THEMES.ROOT,
  ];

  /**
   * Groups whose pages are the console's own upkeep — people, extensions, activity and the platform's
   * tools — rather than the site's daily work. They are listed under Settings at the foot of the menu,
   * so the menu above it holds only the sections a shop or a site is run from.
   */
  static readonly settingsAreaGroups: string[] = ['management', 'platform', 'system'];

  /**
   * The menu as it is drawn: one column of sections with no headings, then what belongs under Settings.
   * The dashboard leads; the framework's other daily screen (media) closes the list; everything plugins
   * declare sits between, in group order and then by each item's priority.
   */
  static sections(groupedMenu: Record<string, any[]>, settingsPath: string): { main: any[]; settingsArea: any[] } {
    const root = NavUtils.normalizePath(AdminConstants.ROUTES.ROOT);
    const media = NavUtils.normalizePath(AdminConstants.ROUTES.MEDIA.ROOT);
    const core = groupedMenu['core'] || [];
    const at = (path: string) => core.filter((item) => NavUtils.normalizePath(item.path) === path);
    const plugins = SidebarMenuService.sortGroups(groupedMenu)
      .filter((group) => group !== 'core' && !SidebarMenuService.settingsAreaGroups.includes(group))
      .flatMap((group) => SidebarMenuService.byPlugin(groupedMenu[group] || []));
    const settings = NavUtils.normalizePath(settingsPath);
    const settingsArea = [
      ...core.filter((item) => ![root, media].includes(NavUtils.normalizePath(item.path))),
      ...SidebarMenuService.settingsAreaGroups.flatMap((group) => groupedMenu[group] || []),
    ].filter((item) => NavUtils.normalizePath(item.path) !== settings);
    return { main: [...at(root), ...plugins, ...at(media)], settingsArea };
  }

  /**
   * A group's items with each plugin's sections kept together, in the order its first one arrives:
   * two plugins sharing a group otherwise interleave by priority (a shop's Orders, then a carrier's
   * overview, then the shop's Products). Each plugin's own order is its declared priority.
   */
  static byPlugin(items: any[]): any[] {
    const rank = new Map<string, number>();
    items.forEach((item) => {
      const slug = String(item?.pluginSlug || '');
      if (!rank.has(slug)) rank.set(slug, rank.size);
    });
    return items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (rank.get(String(a.item?.pluginSlug || ''))! - rank.get(String(b.item?.pluginSlug || ''))!) || a.index - b.index)
      .map(({ item }) => item);
  }

  static authorizeMenuItems(menuItems: any[], user: any): any[] {
    // Admins see everything.
    const isAdmin = !!user?.roles?.includes('admin');
    if (isAdmin) return menuItems;

    // Everyone else sees exactly the items whose permission they hold (or a wildcard covering it).
    // The metadata names that permission on every item: a plugin's collection list asks for reading
    // that collection, its other screens for `<plugin>:manage`, a framework screen for the permission
    // its API checks. An item that names none — Plugins, Themes, Settings — is administrators' only.
    //
    // A plugin's pages usually arrive as ONE dropdown group whose `children` are those items, so the
    // rule is applied to the children too; a group left with none is dropped.
    const permissions: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
    return SidebarMenuService.permitted(menuItems, permissions);
  }

  /**
   * Where a scoped (non-admin) console user should land: the first screen their menu offers. The
   * dashboard is built from platform-wide statistics such a user may not read, so opening it showed
   * them a page of "could not be read" instead of their own work. Empty when nothing is offered.
   */
  static homePathFor(menuItems: any[], user: any): string {
    const first = (items: any[]): string => {
      for (const item of items) {
        const nested = Array.isArray(item?.children) && item.children.length > 0 ? first(item.children) : '';
        if (nested) return nested;
        if (!item?.isGroup && item?.path) return String(item.path);
      }
      return '';
    };
    return first(SidebarMenuService.authorizeMenuItems(menuItems, user));
  }

  private static permitted(menuItems: any[], permissions: string[]): any[] {
    return menuItems.flatMap((item) => {
      if (Array.isArray(item?.children) && item.children.length > 0) {
        const children = SidebarMenuService.permitted(item.children, permissions);
        return children.length > 0 ? [{ ...item, children }] : [];
      }
      const required = String(item?.permission || '').trim();
      return required && PermissionGrants.covers(permissions, required) ? [item] : [];
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
    // a group label carrying internal capitals keeps them in the sidebar header.
    const groupLabels: Record<string, string> = {};
    const groupedMenu = groupedMenuItems.reduce((acc: Record<string, any[]>, item) => {
      // Filed by the group as DECLARED (`groupKey`), not by its translation, which differs per language.
      const rawGroup = NavUtils.normalizeGroupKey(item.groupKey || item.group);
      const originalLabel = String(item.group || '').trim();
      const groupKey = SidebarMenuService.resolveGroupKey(item.path, rawGroup);

      // First item in this group wins the display label (all items in a group should have
      // the same casing). Built-in groups keep their configured label; plugin/theme groups
      // use the original casing so a label with internal capitals is not flattened.
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

  /**
   * The pages plugins filed under the System group. That group is drawn by hand at the foot of the
   * sidebar (Activity, Settings), not in the list `sortGroups` returns, so these are added to it there
   * — without them a plugin page that chose System had no way in from the menu.
   */
  static systemPluginItems(groupedMenu: Record<string, any[]>, settingsPath: string): any[] {
    const own = new Set([AdminConstants.ROUTES.ACTIVITY, settingsPath].filter(Boolean).map((path) => NavUtils.normalizePath(path)));
    return (groupedMenu['system'] || []).filter((item) => item?.pluginSlug && item.pluginSlug !== 'system' && !own.has(NavUtils.normalizePath(item.path)));
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
    const normalizedGroup = NavUtils.normalizeGroupKey(activeTopLevelItem?.groupKey || activeTopLevelItem?.group);
    const path = String(activeTopLevelItem?.path || '');
    if (SidebarMenuService.coreGroupPaths.includes(path)) return 'core';
    if (SidebarMenuService.managementGroupPaths.includes(path)) return 'management';
    if (path === AdminConstants.ROUTES.ACTIVITY) return 'system';
    return normalizedGroup;
  }
}
