import { StringUtils } from '@core/utils/string-utils';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * An AREA of the console's menu: the work a page belongs to, named by a key several plugins share.
 *
 * Kept apart from the menu builder so each file has one job — the builder collects what every plugin
 * offers, this decides how an area reads.
 */
export class AdminMenuAreaService {
  /**
   * What a plugin says about an area it OWNS: `admin.areas: [{ key, icon, priority }]`. Any plugin may
   * file its pages into an area; the one that owns the work declares how that row looks. Nothing is
   * named here — the framework only reads the key back.
   */
  static declared(key: string, allPlugins: ILoadedPlugin[]): { icon?: string; priority?: number } | null {
    for (const plugin of allPlugins) {
      const areas = (plugin?.manifest?.admin as { areas?: Array<{ key?: string; icon?: string; priority?: number }> } | undefined)?.areas;
      if (!Array.isArray(areas)) continue;
      const found = areas.find((area) => StringUtils.slugify(String(area?.key ?? ''), '') === key);
      if (found) return { icon: found.icon ? String(found.icon) : undefined, priority: typeof found.priority === 'number' ? found.priority : undefined };
    }
    return null;
  }

  /**
   * The pages of one area, in reading order: a plugin's pages stay together and the plugins follow each
   * other by the priority of their first page. Sorted by priority alone the area interleaved them —
   * "Orders, Overview, Catalog, Shipping Methods, Customers, Shipments" — because every plugin numbers
   * its own menu from 1, so the numbers mean nothing across two plugins.
   *
   * A plugin's own landing page (`/<slug>`) is named after the PLUGIN inside a shared area: five rows
   * reading "Overview" tell the operator nothing about which five things they open.
   */
  static order(items: any[], allPlugins: ILoadedPlugin[]): any[] {
    const blocks = new Map<string, any[]>();
    items.forEach((item) => {
      const slug = String(item.pluginSlug || '');
      if (!blocks.has(slug)) blocks.set(slug, []);
      (blocks.get(slug) as any[]).push(item);
    });
    const ordered: any[] = [];
    [...blocks.entries()]
      .map(([slug, list]) => ({
        slug,
        list: [...list].sort((a, b) => (a.priority || 0) - (b.priority || 0)),
      }))
      .sort((a, b) => (a.list[0]?.priority || 0) - (b.list[0]?.priority || 0) || a.slug.localeCompare(b.slug))
      .forEach(({ slug, list }) => {
        const label = String(allPlugins.find((p) => p.manifest.slug === slug)?.manifest.admin?.label || '').trim();
        list.forEach((item) => {
          const isLanding = String(item.path || '') === `/${slug}`;
          ordered.push(isLanding && label ? { ...item, label } : item);
        });
      });
    return ordered;
  }

}
