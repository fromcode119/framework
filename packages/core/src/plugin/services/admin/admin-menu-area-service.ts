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
   *
   * WHICH plugin comes first is the platform's to say, not the plugins': ordered by the first page's
   * number, "Content" opened with a comment plugin's Facebook screen and listed CMS — the plugin that
   * declares the area — eighth. The plugin that OWNS the area leads; the rest follow by name, which is
   * stable whatever each one numbered its own menu.
   */
  static order(items: any[], allPlugins: ILoadedPlugin[]): any[] {
    const ownerSlug = AdminMenuAreaService.ownerOf(items, allPlugins);
    const stamped = items.map((item) => AdminMenuAreaService.withBlock(item, allPlugins));
    const blocks = new Map<string, any[]>();
    stamped.forEach((item) => {
      const key = String(item.blockKey || item.pluginSlug || '');
      if (!blocks.has(key)) blocks.set(key, []);
      (blocks.get(key) as any[]).push(item);
    });
    const ordered: any[] = [];
    [...blocks.entries()]
      .map(([key, list]) => {
        const home = String(list[0]?.blockOwnerSlug || list[0]?.pluginSlug || '');
        return {
          key,
          home,
          // Inside a piece of work, the plugin that owns it comes first — a courier's pages read after
          // the delivery they belong to, never before it.
          list: [...list].sort((a, b) => Number(String(b.pluginSlug) === home) - Number(String(a.pluginSlug) === home)
            || (a.priority || 0) - (b.priority || 0)),
          owner: home === ownerSlug,
          name: AdminMenuAreaService.nameOf(home, allPlugins),
        };
      })
      .sort((a, b) => Number(b.owner) - Number(a.owner) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key))
      .forEach(({ home, list }) => {
        const label = String(allPlugins.find((p) => p.manifest.slug === home)?.manifest.admin?.label || '').trim();
        list.forEach((item) => {
          const isLanding = String(item.path || '') === `/${item.pluginSlug}`;
          ordered.push(isLanding && label && String(item.pluginSlug) === home ? { ...item, label } : item);
        });
      });
    return ordered;
  }

  /** The plugin that DECLARES this area (`admin.areas`), among the ones whose pages stand in it. */
  private static ownerOf(items: any[], allPlugins: ILoadedPlugin[]): string {
    const key = StringUtils.slugify(String(items[0]?.group ?? ''), '');
    const present = new Set(items.map((item) => String(item.pluginSlug || '')));
    for (const plugin of allPlugins) {
      const slug = String(plugin?.manifest?.slug ?? '');
      if (!present.has(slug)) continue;
      const areas = (plugin?.manifest?.admin as { areas?: Array<{ key?: string }> } | undefined)?.areas;
      if (Array.isArray(areas) && areas.some((area) => StringUtils.slugify(String(area?.key ?? ''), '') === key)) return slug;
    }
    return '';
  }

  /** The plugin's own name, as its manifest declares it — what an area sorts its blocks by. */
  private static nameOf(slug: string, allPlugins: ILoadedPlugin[]): string {
    const plugin = allPlugins.find((candidate) => candidate?.manifest?.slug === slug);
    return String(plugin?.manifest?.admin?.label || plugin?.manifest?.name || slug);
  }

  /**
   * The BLOCK a plugin's pages read under — a piece of WORK inside an area, named by a key several
   * plugins share, exactly as an area is. `admin.block: "delivery"` files a plugin's pages into it;
   * `admin.blocks: [{ key: "delivery" }]` says which plugin owns that work and therefore names it.
   *
   * The menu is a tree of work, not of plugins: a courier adapter's one table belongs inside delivery,
   * not beside it, and a plugin that owns no work of its own has no row at all.
   */
  static blockKeyOf(manifest: any): string {
    const joined = StringUtils.slugify(String(manifest?.admin?.block ?? ''), '');
    if (joined) return joined;
    // The plugin that OWNS one piece of work reads under it too, without having to say so twice.
    // Declaring several leaves its own pages where they are, since none of them is the obvious one.
    const owned = (manifest?.admin as { blocks?: Array<{ key?: string }> } | undefined)?.blocks;
    return Array.isArray(owned) && owned.length === 1 ? StringUtils.slugify(String(owned[0]?.key ?? ''), '') : '';
  }

  /** The plugin that OWNS a block (`admin.blocks`), whose name the block is read by. */
  static blockOwner(key: string, allPlugins: ILoadedPlugin[]): ILoadedPlugin | null {
    if (!key) return null;
    for (const plugin of allPlugins) {
      const blocks = (plugin?.manifest?.admin as { blocks?: Array<{ key?: string }> } | undefined)?.blocks;
      if (Array.isArray(blocks) && blocks.some((block) => StringUtils.slugify(String(block?.key ?? ''), '') === key)) return plugin;
    }
    return null;
  }

  /** A page of a block carries the block's key and the name of the plugin that owns that work. */
  private static withBlock(item: any, allPlugins: ILoadedPlugin[]): any {
    const key = String(item?.blockKey || '');
    if (!key) return item;
    const owner = AdminMenuAreaService.blockOwner(key, allPlugins);
    if (!owner) return item;
    return {
      ...item,
      blockOwnerSlug: String(owner.manifest.slug || ''),
      blockLabel: String(owner.manifest.admin?.label || owner.manifest.name || ''),
      blockPath: `/${owner.manifest.slug}`,
    };
  }
}
