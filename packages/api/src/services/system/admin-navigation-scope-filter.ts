import { RequestContextUtils, TenantMode } from '@fromcode119/core';

/**
 * Which navigation an operator is actually handed, for the scope they are actually in.
 *
 * TWO AXES, AND THEY ARE NOT THE SAME QUESTION. `platformOnly` is about WHO you are — a tenant's own
 * administrator must never be handed the platform's registry. `siteOnly` is about WHERE YOU ARE — a
 * platform admin standing on no site cannot be shown screens whose data is tenant-scoped, because
 * with no tenant bound every one of those tables answers zero rows. The page would render an empty
 * list and explain nothing, which is worse than not offering it.
 *
 * FILTERED SERVER SIDE, like the platform filter beside it and for the same reason: hiding an entry
 * in the client still hands the payload out.
 */
export class AdminNavigationScopeFilter {
  /** Whether this request is standing on a site. A single-tenant deployment is always "on" its site. */
  static hasSite(): boolean {
    if (!TenantMode.isEnabled()) return true;
    return String(RequestContextUtils.getTenantId() ?? '').trim().length > 0;
  }

  /**
   * The menu for this scope, and the paths that were removed.
   *
   * The removed paths are returned rather than dropped silently: the admin needs them to tell "this
   * page belongs to a site" from "no such page", so a bookmarked link lands on an explanation and a
   * site list instead of a blank screen.
   */
  static apply(menu: unknown, isPlatformAdmin: boolean): { menu: unknown[]; removedPaths: string[] } {
    const items = Array.isArray(menu) ? menu : [];
    const onSite = AdminNavigationScopeFilter.hasSite();
    const removedPaths: string[] = [];

    const kept = items.filter((item: any) => {
      if (!isPlatformAdmin && item?.platformOnly === true) return false;
      if (!onSite && item?.siteOnly === true) {
        const path = String(item?.path ?? '').trim();
        if (path) removedPaths.push(path);
        return false;
      }
      return true;
    });

    return { menu: kept, removedPaths };
  }

  /** The same rule for the secondary panel, whose entries carry the same two flags. */
  static applyToPanel(panel: unknown, isPlatformAdmin: boolean): { panel: unknown; removedPaths: string[] } {
    const bag = (panel && typeof panel === 'object' ? panel : {}) as Record<string, unknown>;
    const removedPaths: string[] = [];
    const filtered: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(bag)) {
      if (!Array.isArray(value)) {
        filtered[key] = value;
        continue;
      }
      const result = AdminNavigationScopeFilter.apply(value, isPlatformAdmin);
      filtered[key] = result.menu;
      removedPaths.push(...result.removedPaths);
    }

    return { panel: filtered, removedPaths };
  }
}
