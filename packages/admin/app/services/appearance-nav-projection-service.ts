import type { IMenuItem, ISecondaryPanelItem, ISecondaryPanelState } from '@fromcode119/react';
import { SecondarySidebarContextResolver } from '@/app/services/secondary-sidebar-context-resolver';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';
import type { IAppearanceNavItem } from '@/lib/appearance/interfaces/appearance-nav-item.interface';
import type { IAppearanceShellProps } from '@/lib/appearance/interfaces/appearance-shell-props.interface';

/**
 * Projects the plugin-driven admin menu (MenuItem[]) into the read-only nav model handed to
 * appearance shells. Pure + hook-free so it can run from the shim or be unit-tested directly.
 */
export class AppearanceNavProjectionService {
  static project(menuItems: unknown): IAppearanceNavItem[] {
    if (!Array.isArray(menuItems)) return [];
    return menuItems.map((item) => AppearanceNavProjectionService.projectItem(item));
  }

  /**
   * The nav model for one viewer: the menu through `SidebarMenuService.authorizeMenuItems` and every
   * secondary-panel entry through `SecondarySidebarContextResolver.accessibleItems` — the same two rules
   * the default sidebar applies — so an appearance shell lists only screens this person may open.
   */
  static authorized(menuItems: unknown, secondaryPanel: ISecondaryPanelState | null | undefined, user: any, activePath: string): NonNullable<IAppearanceShellProps['nav']> {
    const menu: IMenuItem[] = Array.isArray(menuItems) ? menuItems : [];
    const panel: ISecondaryPanelItem[] = [
      ...Object.values(secondaryPanel?.itemsByContext || {}).flat(),
      ...(secondaryPanel?.globalItems || []),
    ];
    const roles: string[] = user?.roles || [];
    const permissions: string[] = user?.permissions || [];
    return {
      items: AppearanceNavProjectionService.project(SidebarMenuService.authorizeMenuItems(menu, user)),
      panelItems: AppearanceNavProjectionService.project(SecondarySidebarContextResolver.accessibleItems(panel, menu, roles, permissions)),
      activePath,
    };
  }

  private static projectItem(item: any): IAppearanceNavItem {
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
