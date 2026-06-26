import type { AppearanceNavItem } from '@/lib/appearance/appearance-shell-props.interfaces';

/**
 * Projects the plugin-driven admin menu (MenuItem[]) into the read-only nav model handed to
 * appearance shells. Pure + hook-free so it can run from the shim or be unit-tested directly.
 */
export class AppearanceNavProjectionService {
  static project(menuItems: unknown): AppearanceNavItem[] {
    if (!Array.isArray(menuItems)) return [];
    return menuItems.map((item) => AppearanceNavProjectionService.projectItem(item));
  }

  private static projectItem(item: any): AppearanceNavItem {
    const children = Array.isArray(item?.children) && item.children.length
      ? item.children.map((child: any) => AppearanceNavProjectionService.projectItem(child))
      : undefined;
    return {
      path: String(item?.path ?? ''),
      label: String(item?.label ?? ''),
      icon: item?.icon ? String(item.icon) : undefined,
      group: item?.group ? String(item.group) : undefined,
      pluginSlug: item?.pluginSlug ? String(item.pluginSlug) : undefined,
      children,
    };
  }
}
