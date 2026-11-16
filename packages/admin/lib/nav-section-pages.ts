import { NavUtils } from '@/lib/nav-utils';

/**
 * The pages under a section, arranged as the menu draws them.
 *
 * A page with no group stands on its own line. Pages sharing a group become ONE line, the sub-menu, and
 * its pages are drawn under it only while the current page is one of them — the same rule the menu keeps
 * for a section (nothing opens or closes by hand). A group holding one page is just that page, and when
 * every page shares one group there is nothing to divide, so the section lists them as they are.
 *
 * A group named after the section itself is not a sub-menu either. Finance's collections declare
 * `group: "Finance"`, so the menu drew Финанси › Финанси › Преглед — three lines saying the same word
 * before the first real page, and a level that led nowhere. Those pages stand directly under the section.
 */
export class NavSectionPages {
  /** Each line under an open section of the menu: a page, or a sub-menu holding several. */
  static arrange(pages: any[], sectionLabel = ''): Array<{ kind: 'page'; page: any } | { kind: 'group'; name: string; pages: any[] }> {
    const byPlugin = NavSectionPages.blocks(pages);
    if (byPlugin) return byPlugin;
    const section = String(sectionLabel || '').trim().toLocaleLowerCase();
    const groupOf = (page: any): string => {
      const group = String(page?.group || '').trim();
      return section && group.toLocaleLowerCase() === section ? '' : group;
    };
    const counts = new Map<string, number>();
    pages.forEach((page) => {
      const group = groupOf(page);
      if (group) counts.set(group, (counts.get(group) || 0) + 1);
    });
    const divided = [...counts.values()].filter((count) => count > 1).length;
    const ungrouped = pages.some((page) => !groupOf(page) || counts.get(groupOf(page)) === 1);
    if (divided === 0 || (divided === 1 && !ungrouped)) return pages.map((page) => ({ kind: 'page', page }));

    const entries: Array<{ kind: 'page'; page: any } | { kind: 'group'; name: string; pages: any[] }> = [];
    const groups = new Map<string, { kind: 'group'; name: string; pages: any[] }>();
    pages.forEach((page) => {
      const group = groupOf(page);
      if (!group || counts.get(group) === 1) {
        entries.push({ kind: 'page', page });
        return;
      }
      let entry = groups.get(group);
      if (!entry) {
        entry = { kind: 'group', name: group, pages: [] };
        groups.set(group, entry);
        entries.push(entry);
      }
      entry.pages.push(page);
    });
    // Pages standing on their own first, then the sub-menus, each keeping the order it was declared in.
    return [...entries.filter((entry) => entry.kind === 'page'), ...entries.filter((entry) => entry.kind === 'group')];
  }


  /**
   * An AREA is read as its pieces of WORK, each one line: its name, and its pages under it only while
   * you are inside it — the same rule every section keeps.
   *
   * The unit is the work, not the plugin. A plugin says which work its pages belong to (`admin.block`),
   * so a courier adapter's one table reads inside delivery and the adapter itself has no row anywhere.
   * A plugin that names no work is one piece of work of its own, under its own name — the fallback, not
   * the rule. A single page is a line of its own: a line that opens a list of one says nothing.
   */
  private static blocks(pages: any[]): Array<{ kind: 'page'; page: any } | { kind: 'group'; name: string; pages: any[]; href?: string }> | null {
    const keyOf = (page: any): string => String(page?.blockKey || page?.pluginSlug || '');
    const keys = new Set(pages.map(keyOf).filter(Boolean));
    if (keys.size < 2) return null;
    const order: string[] = [];
    const blocks = new Map<string, any[]>();
    pages.forEach((page) => {
      const key = keyOf(page);
      if (!blocks.has(key)) { blocks.set(key, []); order.push(key); }
      (blocks.get(key) as any[]).push(page);
    });
    return order.map((key) => {
      const list = blocks.get(key) as any[];
      if (list.length === 1) return { kind: 'page' as const, page: list[0] };
      const home = String(list[0]?.blockPath || `/${list[0]?.pluginSlug || ''}`);
      const landing = list.find((page) => NavUtils.normalizePath(page?.path) === home);
      const rest = landing ? list.filter((page) => page !== landing) : list;
      const name = String(list[0]?.blockLabel || landing?.label || list[0]?.pluginLabel || list[0]?.label || '').trim();
      return { kind: 'group' as const, name, pages: rest, href: String(landing?.path || rest[0]?.path || '') };
    });
  }

  /** Whether a sub-menu holds the page now open. */
  static holds(entry: { pages: any[] }, activePath: string): boolean {
    return Boolean(activePath) && entry.pages.some((page) => NavUtils.normalizePath(page.path) === activePath);
  }
}
