import { NavUtils } from '@/lib/nav-utils';

/**
 * The pages under a section, arranged as the menu draws them.
 *
 * A page with no group stands on its own line. Pages sharing a group become ONE line, the sub-menu, and
 * its pages are drawn under it only while the current page is one of them — the same rule the menu keeps
 * for a section (nothing opens or closes by hand). A group holding one page is just that page, and when
 * every page shares one group there is nothing to divide, so the section lists them as they are.
 */
export class NavSectionPages {
  /** Each line under an open section of the menu: a page, or a sub-menu holding several. */
  static arrange(pages: any[]): Array<{ kind: 'page'; page: any } | { kind: 'group'; name: string; pages: any[] }> {
    const groupOf = (page: any): string => String(page?.group || '').trim();
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

  /** Whether a sub-menu holds the page now open. */
  static holds(entry: { pages: any[] }, activePath: string): boolean {
    return Boolean(activePath) && entry.pages.some((page) => NavUtils.normalizePath(page.path) === activePath);
  }
}
