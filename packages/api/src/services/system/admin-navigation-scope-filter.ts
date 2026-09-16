import { RequestContextUtils, TenantMode } from '@fromcode119/core';

/**
 * Which navigation an operator is actually handed, for the scope they are actually in.
 *
 * TWO AXES, AND THEY ARE NOT THE SAME QUESTION. `platformOnly` is about WHO you are — a tenant's own
 * administrator must never be handed the platform's registry. `siteOnly` and `platformScopeOnly` are
 * about WHERE YOU ARE, and they are a pair:
 *
 *   `siteOnly`          — needs a site. With none bound every tenant-scoped table answers zero rows,
 *                         so the page renders an empty list and explains nothing.
 *   `platformScopeOnly` — belongs to the platform. These screens have no tenant column, so standing
 *                         in a site changes nothing about what they show — which is why leaving them
 *                         visible there mixed the two worlds: a platform admin who stepped into a
 *                         site saw that site's people and media beside the registry of every site and
 *                         every repository this installation builds.
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
  static apply(
    menu: unknown,
    isPlatformAdmin: boolean,
  ): { menu: unknown[]; removedPaths: string[]; platformPaths: string[] } {
    const items = Array.isArray(menu) ? menu : [];
    const onSite = AdminNavigationScopeFilter.hasSite();
    const removedPaths: string[] = [];
    const platformPaths: string[] = [];

    const kept = items.filter((item: any) => {
      if (!isPlatformAdmin && item?.platformOnly === true) return false;
      if (!onSite && item?.siteOnly === true) {
        const path = String(item?.path ?? '').trim();
        if (path) removedPaths.push(path);
        return false;
      }
      if (onSite && item?.platformScopeOnly === true) {
        const path = String(item?.path ?? '').trim();
        if (path) platformPaths.push(path);
        return false;
      }
      return true;
    });

    return { menu: kept, removedPaths, platformPaths };
  }

  /** The same rule for the secondary panel, whose entries carry the same two flags. */
  static applyToPanel(
    panel: unknown,
    isPlatformAdmin: boolean,
  ): { panel: unknown; removedPaths: string[]; platformPaths: string[] } {
    const bag = (panel && typeof panel === 'object' ? panel : {}) as Record<string, unknown>;
    const removedPaths: string[] = [];
    const platformPaths: string[] = [];
    const filtered: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(bag)) {
      if (!Array.isArray(value)) {
        filtered[key] = value;
        continue;
      }
      const result = AdminNavigationScopeFilter.apply(value, isPlatformAdmin);
      filtered[key] = result.menu;
      removedPaths.push(...result.removedPaths);
      platformPaths.push(...result.platformPaths);
    }

    return { panel: filtered, removedPaths, platformPaths };
  }
}
