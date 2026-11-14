import { describe, expect, it } from 'vitest';
import { NavSectionPages } from '@/lib/nav-section-pages';

const page = (path: string, group?: string) => ({ path, group });

describe('NavSectionPages.arrange', () => {
  it('lists pages as they are when nothing is grouped', () => {
    const entries = NavSectionPages.arrange([page('/a'), page('/b')]);
    expect(entries.map((entry) => entry.kind)).toEqual(['page', 'page']);
  });

  it('draws a group holding one page as that page', () => {
    const entries = NavSectionPages.arrange([page('/a'), page('/b', 'Returns'), page('/c', 'Delivery'), page('/d', 'Delivery')]);
    expect(entries).toHaveLength(3);
    expect(entries[1]).toEqual({ kind: 'page', page: page('/b', 'Returns') });
    expect(entries[2]).toMatchObject({ kind: 'group', name: 'Delivery' });
  });

  it('does not divide a section whose pages all share one group', () => {
    const entries = NavSectionPages.arrange([page('/a', 'One'), page('/b', 'One')]);
    expect(entries.every((entry) => entry.kind === 'page')).toBe(true);
  });

  it('puts plain pages first, then the sub-menus in declared order', () => {
    const entries = NavSectionPages.arrange([page('/r1', 'Returns'), page('/a'), page('/r2', 'Returns'), page('/d1', 'Delivery'), page('/d2', 'Delivery')]);
    expect(entries.map((entry) => (entry.kind === 'page' ? entry.page.path : entry.name))).toEqual(['/a', 'Returns', 'Delivery']);
    const returns = entries[1];
    expect(returns.kind === 'group' && returns.pages.map((entry) => entry.path)).toEqual(['/r1', '/r2']);
  });
});

describe('NavSectionPages.holds', () => {
  it('is true only for a group holding the open page', () => {
    const group = { pages: [page('/area/refunds'), page('/area/withdrawals')] };
    expect(NavSectionPages.holds(group, '/area/refunds')).toBe(true);
    expect(NavSectionPages.holds(group, '/area/orders')).toBe(false);
    expect(NavSectionPages.holds(group, '')).toBe(false);
  });
});
