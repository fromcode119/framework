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
    from('writing', '/writing', 'Writing', 'Writing'),
    from('writing', '/writing/articles', 'Articles', 'Writing'),
    from('writing', '/writing/pages', 'Pages', 'Writing'),
    from('intake', '/intake', 'Intake', 'Intake'),
    from('intake', '/intake/submissions', 'Submissions', 'Intake'),
    from('ranking', '/ranking', 'Ranking', 'Ranking'),
  ];

  it('draws one line per plugin, named by the plugin', () => {
    const entries = NavSectionPages.arrange(area, 'Content');
    expect(entries.map((entry) => (entry.kind === 'page' ? entry.page.path : `group:${entry.name}`)))
      .toEqual(['group:Writing', 'group:Intake', '/ranking']);
  });

  it('opens the plugin line at the plugin itself, and does not repeat it below', () => {
    const entries = NavSectionPages.arrange(area, 'Content');
    const block = entries[0];
    expect(block.kind === 'group' && block.href).toBe('/writing');
    expect(block.kind === 'group' && block.pages.map((page: any) => page.path)).toEqual(['/writing/articles', '/writing/pages']);
  });

  it('keeps a plugin with one page as that page', () => {
    const entries = NavSectionPages.arrange(area, 'Content');
    expect(entries[2]).toMatchObject({ kind: 'page' });
  });

  it('leaves a section of one plugin exactly as it was', () => {
    const own = [from('charts', '/charts', 'Overview', 'Charts'), from('charts', '/charts/profiles', 'Profiles', 'Charts')];
    const entries = NavSectionPages.arrange(own, 'Charts');
    expect(entries.every((entry) => entry.kind === 'page')).toBe(true);
  });

  it('names a plugin that has no landing page after the plugin, not after its first page', () => {
    const mixed = [
      from('writing', '/writing', 'Writing', 'Writing'),
      from('writing', '/writing/pages', 'Pages', 'Writing'),
      from('mailer', '/mailer/lists', 'Lists', 'Mailer'),
      from('mailer', '/mailer/campaigns', 'Campaigns', 'Mailer'),
    ];
    const entries = NavSectionPages.arrange(mixed, 'Content');
    expect(entries.map((entry) => (entry.kind === 'group' ? entry.name : entry.page.path))).toEqual(['Writing', 'Mailer']);
    const mailer = entries[1];
    expect(mailer.kind === 'group' && mailer.pages).toHaveLength(2);
  });
});

describe('NavSectionPages.arrange — the work is the unit, not the plugin', () => {
  const page = (slug: string, path: string, label: string, extra: Record<string, unknown> = {}) =>
    ({ path, label, pluginSlug: slug, group: 'Commerce', ...extra });

  const delivery = { blockKey: 'delivery', blockLabel: 'Delivery', blockPath: '/parcels', blockOwnerSlug: 'parcels' };

  const area = [
    page('shop', '/shop', 'Shop', { pluginLabel: 'Shop' }),
    page('shop', '/shop/orders', 'Orders', { pluginLabel: 'Shop' }),
    page('parcels', '/parcels', 'Delivery', { ...delivery, pluginLabel: 'Delivery' }),
    page('parcels', '/parcels/methods', 'Methods', { ...delivery, pluginLabel: 'Delivery' }),
    page('carrier', '/carrier/offices', 'Offices', { ...delivery, pluginLabel: 'Carrier' }),
  ];

  it('reads an adapter inside the work it serves, never as a line of its own', () => {
    const entries = NavSectionPages.arrange(area, 'Commerce');
    expect(entries.map((entry) => (entry.kind === 'group' ? entry.name : entry.page.path))).toEqual(['Shop', 'Delivery']);
  });

  it('names the work after the plugin that owns it, not after whoever contributed a page', () => {
    const block = NavSectionPages.arrange(area, 'Commerce')[1];
    expect(block.kind === 'group' && block.name).toBe('Delivery');
    expect(block.kind === 'group' && block.href).toBe('/parcels');
    expect(block.kind === 'group' && block.pages.map((p: any) => p.path)).toEqual(['/parcels/methods', '/carrier/offices']);
  });

  it('gives a plugin whose only page joined another plugin\'s work no row at all', () => {
    const entries = NavSectionPages.arrange(area, 'Commerce');
    const rows = entries.map((entry) => (entry.kind === 'group' ? entry.name : entry.page.label));
    expect(rows).not.toContain('Carrier');
  });
});
