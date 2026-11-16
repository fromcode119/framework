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

  it('does not make a sub-menu of a group named after the section itself', () => {
    const entries = NavSectionPages.arrange([page('/f', 'Finance'), page('/t', 'Finance'), page('/c', 'Setup'), page('/r', 'Setup')], 'Finance');
    expect(entries.map((entry) => (entry.kind === 'page' ? entry.page.path : `group:${entry.name}`)))
      .toEqual(['/f', '/t', 'group:Setup']);
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

describe('NavSectionPages.arrange — an area of several plugins', () => {
  const from = (slug: string, path: string, label: string, pluginLabel: string) => ({ path, label, pluginSlug: slug, pluginLabel, group: 'Content' });

  const area = [
    from('cms', '/cms', 'CMS', 'CMS'),
    from('cms', '/cms/posts', 'Posts', 'CMS'),
    from('cms', '/cms/pages', 'Pages', 'CMS'),
    from('forms', '/forms', 'Forms', 'Forms'),
    from('forms', '/forms/submissions', 'Submissions', 'Forms'),
    from('seo', '/seo', 'SEO', 'SEO'),
  ];

  it('draws one line per plugin, named by the plugin', () => {
    const entries = NavSectionPages.arrange(area, 'Content');
    expect(entries.map((entry) => (entry.kind === 'page' ? entry.page.path : `group:${entry.name}`)))
      .toEqual(['group:CMS', 'group:Forms', '/seo']);
  });

  it('opens the plugin line at the plugin itself, and does not repeat it below', () => {
    const entries = NavSectionPages.arrange(area, 'Content');
    const cms = entries[0];
    expect(cms.kind === 'group' && cms.href).toBe('/cms');
    expect(cms.kind === 'group' && cms.pages.map((page: any) => page.path)).toEqual(['/cms/posts', '/cms/pages']);
  });

  it('keeps a plugin with one page as that page', () => {
    const entries = NavSectionPages.arrange(area, 'Content');
    expect(entries[2]).toMatchObject({ kind: 'page' });
  });

  it('leaves a section of one plugin exactly as it was', () => {
    const own = [from('numerology', '/numerology', 'Overview', 'Numerology'), from('numerology', '/numerology/profiles', 'Profiles', 'Numerology')];
    const entries = NavSectionPages.arrange(own, 'Readings');
    expect(entries.every((entry) => entry.kind === 'page')).toBe(true);
  });

  it('names a plugin that has no landing page after the plugin, not after its first page', () => {
    const mixed = [
      from('cms', '/cms', 'CMS', 'CMS'),
      from('cms', '/cms/pages', 'Pages', 'CMS'),
      from('broadcasts', '/broadcasts/lists', 'Lists', 'Broadcasts'),
      from('broadcasts', '/broadcasts/campaigns', 'Campaigns', 'Broadcasts'),
    ];
    const entries = NavSectionPages.arrange(mixed, 'Content');
    expect(entries.map((entry) => (entry.kind === 'group' ? entry.name : entry.page.path))).toEqual(['CMS', 'Broadcasts']);
    const broadcasts = entries[1];
    expect(broadcasts.kind === 'group' && broadcasts.pages).toHaveLength(2);
  });
});
