import { PluginState, RequestContextUtils } from '@fromcode119/core';
import { PluginReadRoutes } from '@api/server/plugin-read-routes';
import { PluginReadRouteList } from '@api/server/plugin-read-route-list';

/**
 * The storefront asks for related products by key (`?slugs=a&slugs=b`), and the plugin computed every one of
 * those. A read route can answer them from the stored pages — but only a list it reads exactly as the plugin
 * does, and only as many records as the plugin would return.
 */
describe('a read route that answers a lookup by a list of keys', () => {
  const route: any = {
    path: '/items', requires: ['slugs'], unless: ['limit', 'ids', 'sort', 'view'], collection: 'shop-items', document: 'page',
    freshUntil: 'pageUntil', documentByLocale: true, where: { listed: true },
    filters: { slugs: { field: 'slug', match: 'in', accepts: '^[a-z0-9-]+$', exact: true } },
    sorts: { updatedAt: { field: 'updatedAt' } }, defaultSort: '-updatedAt', defaultLimit: 3, maxLimit: 3,
  };
  const plain: any = { path: '/items', unless: ['slugs', 'ids'], collection: 'shop-items', document: 'page', documentByLocale: true };
  const collection: any = { slug: 'shop-items', fields: [] };
  const future = () => new Date(Date.now() + 60_000).toISOString();

  const run = async (query: Record<string, unknown>, docs: any[] = [{ id: 1, page: { bg: { slug: 'a' } }, pageUntil: future() }], routesUnderTest: any[] = [plain, route]) => {
    const find = vi.fn(async () => ({ docs }));
    const manager: any = {
      getPlugins: () => [{ state: PluginState.ACTIVE, manifest: { slug: 'shop', readRoutes: routesUnderTest } }],
      registeredCollections: new Map([['x', { pluginSlug: 'shop', collection }]]),
    };
    const routes = new PluginReadRoutes(manager, { find } as any);
    const res: any = { set: vi.fn(() => res), json: vi.fn(), status: vi.fn(() => res) };
    const next = vi.fn();
    await RequestContextUtils.storage.run({ locale: 'bg' } as any, async () => {
      routes.handle({ method: 'GET', path: '/shop/items', query } as any, res, next);
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
    return { res, next, find };
  };

  it('reads a list the way the plugin does: commas, repeated parameters, semicolons and line breaks alike', () => {
    expect(PluginReadRouteList.items('a,b')).toEqual(['a', 'b']);
    expect(PluginReadRouteList.items(['a', 'b'])).toEqual(['a', 'b']);
    expect(PluginReadRouteList.items(' a ; b\nc ,, a')).toEqual(['a', 'b', 'c']);
    expect(PluginReadRouteList.items(',')).toEqual([]);
    expect(PluginReadRouteList.items(undefined)).toEqual([]);
  });

  it('answers a lookup from the stored pages, in the order of the route, without the plugin', async () => {
    const { res, next, find } = await run({ slugs: ['a', 'b'] });
    expect(res.json).toHaveBeenCalledWith([{ slug: 'a' }]);
    expect(next).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('is not the route of a request with no list, an empty one, or one it cannot read in full', async () => {
    for (const query of [{}, { slugs: '' }, { slugs: ',' }, { slugs: ['a', 'Bad Slug'] }, { slugs: 'a,b,c,d' }, { slugs: 'a', limit: '2' }, { slugs: 'a', ids: '1' }, { slugs: 'a', sort: 'name' }]) {
      const { res, find } = await run(query, undefined, [route]);
      expect(res.json, JSON.stringify(query)).not.toHaveBeenCalled();
      expect(find, JSON.stringify(query)).not.toHaveBeenCalled();
    }
  });

  it('leaves a lookup to the plugin when a requested record has no page kept', async () => {
    const { res, next } = await run({ slugs: 'a,b' }, [{ id: 1, page: { bg: { slug: 'a' } }, pageUntil: future() }, { id: 2, page: null, pageUntil: null }]);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('narrows the read to the listed keys — the records not prepared yet included', () => {
    const db: any = { eq: vi.fn((c: unknown, v: unknown) => ({ eq: [c, v] })), and: vi.fn((...a: unknown[]) => ({ and: a })), or: vi.fn((...a: unknown[]) => ({ or: a })), inArray: vi.fn((c: unknown, v: unknown) => ({ inArray: [c, v] })) };
    const table: any = { slug: 'slugCol', listed: 'listedCol', id: 'idCol', page: 'pageCol', pageUntil: 'untilCol' };
    const clause: any = PluginReadRoutes.filterClause(db, table, route, { slugs: ['a', 'b'] });
    expect(db.inArray).toHaveBeenCalledWith('slugCol', ['a', 'b']);
    // (listed, or not prepared) AND slug in the list: an unrelated unprepared record is no candidate.
    expect(clause.and).toHaveLength(2);
    expect(clause.and[0]).toHaveProperty('or');
    expect(clause.and[1]).toEqual({ inArray: ['slugCol', ['a', 'b']] });
  });

  it('keeps the other filters\' reading: an unprepared record is still a candidate of a filter on a derived key', () => {
    const db: any = { eq: vi.fn((c: unknown, v: unknown) => ({ eq: [c, v] })), and: vi.fn((...a: unknown[]) => ({ and: a })), or: vi.fn((...a: unknown[]) => ({ or: a })), inArray: vi.fn() };
    const table: any = { kind: 'kindCol', listed: 'listedCol', page: 'pageCol', pageUntil: 'untilCol' };
    const derived: any = { ...route, filters: { kind: { field: 'kind' } } };
    expect((PluginReadRoutes.filterClause(db, table, derived, { kind: 'x' }) as any).or).toHaveLength(2);
  });
});
