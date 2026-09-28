import { AdminConstants } from '@/lib/constants/admin.constants';
import { PermissionGrants } from '@fromcode119/core/utils/permission-grants';

/**
 * Which permission opens an admin page — the page-level half of what the sidebar already decides.
 *
 * Hiding a menu entry is not guarding the page: a bookmark, the back button or a typed URL still
 * rendered it. A staff member with one screen of their own opened `/users/roles/new` and got the whole
 * role form (the save was refused by the API, after they had filled it in).
 *
 * - A plugin page needs the permission its menu item names (the metadata stamps one on every item);
 *   a deeper URL — a record under a list — inherits the nearest item above it.
 * - A framework page needs the permission its API asks for, from {@link RULES}.
 * - Any other framework page (settings, plugins, themes, media, sites…) is administrators' only,
 *   because every route behind it is.
 */
export class AdminPageAccessService {
  /** Stands for "administrators only" — only the Everything grant covers it. */
  private static readonly ADMIN_ONLY = '*';

  /** Framework pages that a non-admin role can open, most specific first. `:x` matches one segment. */
  private static readonly RULES: ReadonlyArray<readonly [string, string]> = [
    [AdminConstants.ROUTES.USERS.ROLE_NEW, 'roles:manage'],
    [AdminConstants.ROUTES.USERS.ROLE_EDIT(':slug'), 'roles:manage'],
    [AdminConstants.ROUTES.USERS.ROLE_LIST, 'roles:view'],
    [AdminConstants.ROUTES.USERS.PERMISSIONS, 'roles:view'],
    [AdminConstants.ROUTES.PEOPLE.DETAIL(':id'), 'users:view'],
    [AdminConstants.ROUTES.PEOPLE.ROOT, 'users:view'],
    [AdminConstants.ROUTES.USERS.NEW, 'users:manage'],
    [AdminConstants.ROUTES.USERS.EDIT(':id'), 'users:manage'],
    [AdminConstants.ROUTES.USERS.ROLES(':id'), 'users:manage'],
    [AdminConstants.ROUTES.USERS.SECURITY(':id'), 'users:manage'],
    [AdminConstants.ROUTES.USERS.DETAIL(':id'), 'users:view'],
    [AdminConstants.ROUTES.USERS.ROOT, 'users:view'],
    [AdminConstants.ROUTES.ACTIVITY, 'system:view'],
  ];

  /** Empty when the page is open to any signed-in user; otherwise the permission it needs. */
  static requiredFor(pathname: string, menuItems: any[], user: any): string {
    const path = AdminPageAccessService.trim(pathname);
    // The dashboard sends a user who cannot read it to their own first screen; it decides itself.
    if (path === AdminPageAccessService.trim(AdminConstants.ROUTES.ROOT)) return '';
    // Your own profile is yours to open, whatever your role.
    if (user?.id && [AdminConstants.ROUTES.USERS.DETAIL(user.id), AdminConstants.ROUTES.USERS.EDIT(user.id), AdminConstants.ROUTES.USERS.SECURITY(user.id)]
      .some((own) => AdminPageAccessService.trim(own) === path)) return '';

    const plugin = AdminPageAccessService.pluginRequirement(path, menuItems);
    if (plugin !== null) return plugin;

    for (const [template, permission] of AdminPageAccessService.RULES) {
      if (AdminPageAccessService.matches(template, path)) return permission;
    }
    return AdminPageAccessService.ADMIN_ONLY;
  }

  static isAllowed(pathname: string, menuItems: any[], user: any): boolean {
    if (user?.roles?.includes('admin')) return true;
    const required = AdminPageAccessService.requiredFor(pathname, menuItems, user);
    if (!required) return true;
    const permissions: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
    return PermissionGrants.covers(permissions, required);
  }

  /**
   * The permission of the deepest plugin menu item at or above this path, or null when the path is not
   * a plugin's. A plugin path that no item covers still belongs to the plugin: its own screens.
   */
  private static pluginRequirement(path: string, menuItems: any[]): string | null {
    let best: { length: number; permission: string } | null = null;
    const visit = (items: any[], inheritedSlug: string): void => {
      for (const item of items ?? []) {
        const slug = String(item?.pluginSlug || inheritedSlug || '').trim().toLowerCase();
        if (Array.isArray(item?.children)) visit(item.children, slug);
        if (!slug || slug === 'system' || item?.isGroup) continue;
        const itemPath = AdminPageAccessService.trim(item?.path);
        if (!itemPath || (path !== itemPath && !path.startsWith(`${itemPath}/`))) continue;
        if (!best || itemPath.length > best.length) {
          best = { length: itemPath.length, permission: String(item?.permission || `${slug}:manage`).trim() };
        }
      }
    };
    visit(menuItems, '');
    if (best) return (best as { permission: string }).permission;

    const first = path.split('/').filter(Boolean)[0] ?? '';
    const owned = AdminPageAccessService.pluginSlugs(menuItems).has(first);
    return owned ? `${first}:manage` : null;
  }

  private static pluginSlugs(menuItems: any[]): Set<string> {
    const slugs = new Set<string>();
    for (const item of menuItems ?? []) {
      const slug = String(item?.pluginSlug || '').trim().toLowerCase();
      if (slug && slug !== 'system') slugs.add(slug);
    }
    return slugs;
  }

  private static matches(template: string, path: string): boolean {
    const want = AdminPageAccessService.trim(template).split('/');
    const have = path.split('/');
    return want.length === have.length && want.every((segment, index) => segment.startsWith(':') || segment === have[index]);
  }

  private static trim(path: unknown): string {
    const value = String(path ?? '').split('?')[0].split('#')[0].trim().toLowerCase().replace(/\/+$/, '');
    return value || '/';
  }
}
