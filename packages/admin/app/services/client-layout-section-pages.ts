import { NavUtils } from '@/lib/nav-utils';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SecondarySidebarContextResolver } from '@/app/services/secondary-sidebar-context-resolver';

/** The pages a menu section holds, resolved for a path whatever page is open. */
export class ClientLayoutSectionPages {
  private static readonly resolver = new SecondarySidebarContextResolver();

  /** The pages under one section's path, as the column beside the menu would list them. */
  static of(path: string, sidebarState: any, user: any): any[] {
    return ClientLayoutSectionPages.resolver.resolve({
      pathname: path,
      primaryContextId: '',
      menuItems: sidebarState.menuItems,
      secondaryPanel: sidebarState.effectiveSecondaryPanel,
      plugins: sidebarState.plugins,
      userRoles: user?.roles || [],
      userCapabilities: user?.permissions || [],
    }).items || [];
  }

  /**
   * Every section's other pages, whatever page is open. The menu lists only the rows a section
   * declares, so these are what the big search reaches — each with its section's name beside it.
   */
  static everySection(sidebarState: any, user: any): Array<{ page: any; section: any }> {
    const settingsRoot = NavUtils.normalizePath(AdminConstants.ROUTES.SETTINGS.ROOT);
    return (sidebarState.menuItems || []).flatMap((section: any) => {
      const path = NavUtils.normalizePath(section?.path);
      if (!path || path === settingsRoot) return [];
      return ClientLayoutSectionPages.of(path, sidebarState, user).map((page: any) => ({ page, section }));
    });
  }
}
