import { PluginState, PluginTenantAccess, TenantMode } from '@fromcode119/core';
import { PluginReadRoutes } from '@api/server/plugin-read-routes';
import { CollectionReadOptions } from '@api/services/collection-read-options';

/**
 * A plugin's public list route used to cost a trip into the plugin's process on every request, even
 * when all it returned was records the plugin could have kept ready. A read route the plugin declares in
 * its manifest is answered by the framework from those records, through the collection's ordinary read.
 */
describe('PluginReadRoutes', () => {
  const route = {
    path: '/items',
    when: { view: 'card' },
    unless: ['slug', 'id'],
    collection: 'shop-items',
    document: 'card',
    filters: { tag: { field: 'tagKeys', match: 'contains', accepts: '^[^\\p{Lu}_]+$' }, kind: { field: 'kind' } },
    sorts: { price: { field: 'price' }, updated: { field: 'updatedAt' } },
    defaultSort: '-updated',
    maxLimit: 100,
    cacheSeconds: 30,
  };
  const ownCollection: any = { slug: 'shop-items', fields: [] };
  const otherCollection: any = { slug: 'shop-items', fields: [] };

  const build = (opts: { state?: any; routes?: any[]; collectionOwner?: string; docs?: any[] } = {}) => {
    const find = vi.fn(async () => ({ docs: opts.docs ?? [{ id: 1, card: { name: 'A' } }, { id: 3, card: { name: 'B' } }] }));
    const manager: any = {
      getPlugins: () => [{ state: opts.state ?? PluginState.ACTIVE, manifest: { slug: 'shop', readRoutes: opts.routes ?? [route] } }],
      registeredCollections: new Map([['x', { pluginSlug: opts.collectionOwner ?? 'shop', collection: opts.collectionOwner && opts.collectionOwner !== 'shop' ? otherCollection : ownCollection }]]),
    };
    return { routes: new PluginReadRoutes(manager, { find } as any), find };
  };
  const request = (path: string, query: Record<string, string>, user?: unknown) => ({ method: 'GET', path, query, user }) as any;
  const response = () => { const res: any = { headers: {} as Record<string, string> }; res.set = vi.fn((k: string, v: string) => { res.headers[k] = v; return res; }); res.json = vi.fn(); res.status = vi.fn(() => res); return res; };

  afterEach(() => vi.restoreAllMocks());

  it('answers a matching request from the stored records, without the plugin', async () => {
    const { routes, find } = build();
    const res = response();
    const next = vi.fn();
    routes.handle(request('/shop/items', { view: 'card', limit: '500', tag: 'new', u: 'x' }), res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([{ name: 'A' }, { name: 'B' }]);
    expect(res.headers['Cache-Control']).toBe('public, max-age=30');
    const [collection, read] = find.mock.calls[0] as any[];
    expect(collection).toBe(ownCollection);
    // Only the clamped limit reaches the collection read; undeclared parameters never become filters.
    expect(read.query).toEqual({ limit: '100' });
    expect(CollectionReadOptions.of(read).where).toBeInstanceOf(Function);
    expect(CollectionReadOptions.of(read)).toMatchObject({ fields: ['card'], withoutTotal: true });
  });

  it('works on an Express request, whose query is a getter on its prototype', async () => {
    const { routes, find } = build();
    const proto = {};
    Object.defineProperty(proto, 'query', { get() { return { view: 'card', limit: '5' }; }, configurable: true });
    const req = Object.create(proto);
    Object.assign(req, { method: 'GET', path: '/shop/items' });
    const res = response();
    routes.handle(req, res, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect((find.mock.calls[0] as any[])[1].query).toEqual({ limit: '5' });
  });

  it('a read that fails is logged and the plugin answers, never a 500 to the visitor', async () => {
    const { routes, find } = build();
    find.mockRejectedValueOnce(new Error('boom'));
    const res = response();
    const next = vi.fn();
    routes.handle(request('/shop/items', { view: 'card' }), res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith());
    expect(res.status).not.toHaveBeenCalled();
  });

  it('leaves the answer to the plugin while any record on the page has no prepared document', async () => {
    const { routes, find } = build({ docs: [{ id: 1, card: { name: 'A' } }, { id: 2, card: null }] });
    const res = response();
    const next = vi.fn();
    routes.handle(request('/shop/items', { view: 'card' }), res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    expect(find).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('never shares a signed-in reader\'s answer', async () => {
    const { routes } = build();
    const res = response();
    routes.handle(request('/shop/items', { view: 'card' }, { id: 1 }), res, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });

  it('passes on what it does not match: another view, a direct lookup, another path, a POST', () => {
    const { routes, find } = build();
    for (const req of [
      request('/shop/items', {}), request('/shop/items', { view: 'full' }), request('/shop/items', { view: 'card', slug: 'a' }),
      request('/shop/other', { view: 'card' }), { method: 'POST', path: '/shop/items', query: { view: 'card' } },
    ]) {
      const next = vi.fn();
      routes.handle(req as any, response(), next);
      expect(next).toHaveBeenCalledTimes(1);
    }
    expect(find).not.toHaveBeenCalled();
  });

  it('leaves a filter value outside its declared pattern to the plugin', () => {
    const { routes, find } = build();
    for (const tag of ['New', 'gift_card', 'Ново']) {
      const next = vi.fn();
      routes.handle(request('/shop/items', { view: 'card', tag }), response(), next);
      expect(next).toHaveBeenCalledTimes(1);
    }
    expect(find).not.toHaveBeenCalled();
    expect(PluginReadRoutes.acceptsValues(route as any, { tag: 'ново-2' })).toBe(true);
    expect(PluginReadRoutes.acceptsValues({ ...route, filters: { tag: { field: 'x', accepts: '(' } } } as any, { tag: 'a' })).toBe(false);
  });

  it('passes on for an inactive plugin, a site that does not run it, or a collection it does not own', () => {
    const inactive = build({ state: PluginState.ERROR });
    const notOwned = build({ collectionOwner: 'blog' });
    for (const routes of [inactive.routes, notOwned.routes]) {
      const next = vi.fn();
      routes.handle(request('/shop/items', { view: 'card' }), response(), next);
      expect(next).toHaveBeenCalled();
    }
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    vi.spyOn(PluginTenantAccess, 'isBundledSlug').mockReturnValue(false);
    vi.spyOn(PluginTenantAccess, 'isEnabledForCurrentTenant').mockReturnValue(false);
    const next = vi.fn();
    build().routes.handle(request('/shop/items', { view: 'card' }), response(), next);
    expect(next).toHaveBeenCalled();
  });

  it('orders by a declared sort in either form, ties by id, else the default sort; unprepared first only on a derived field', () => {
    const db: any = { desc: vi.fn((c: unknown) => ({ desc: c })) };
    const table: any = { price: 'price', updatedAt: 'updated_at', id: 'id', card: 'card' };
    expect(PluginReadRoutes.order(db, table, route as any, 'price-asc')).toHaveLength(2);
    expect(PluginReadRoutes.order(db, table, route as any, '-price')).toEqual([{ desc: 'price' }, { desc: 'id' }]);
    expect(PluginReadRoutes.order(db, table, route as any, '')).toEqual([{ desc: 'updated_at' }, { desc: 'id' }]);
    expect(PluginReadRoutes.order(db, table, { ...route, defaultSort: undefined } as any, '')).toEqual([{ desc: 'id' }]);
    const derived = PluginReadRoutes.order(db, table, route as any, '-price', new Set(['price']));
    expect(derived).toHaveLength(3);
    expect(derived.slice(1)).toEqual([{ desc: 'price' }, { desc: 'id' }]);
  });

  it('leaves to the plugin a sort it does not declare, and a lookup key with any value, even a nested one', () => {
    const { routes, find } = build();
    for (const query of [{ sort: 'name' }, { sort: 'costPrice-desc' }, { slug: { equals: 'a' } }, { id: ['1'] }]) {
      const next = vi.fn();
      routes.handle(request('/shop/items', { view: 'card', ...query } as any), response(), next);
      expect(next).toHaveBeenCalledTimes(1);
    }
    expect(find).not.toHaveBeenCalled();
  });

  it('builds only the declared filters the request names, and always lets an unprepared record in', () => {
    const db: any = { eq: vi.fn((c: unknown, v: unknown) => ({ eq: [c, v] })), and: vi.fn((...a: unknown[]) => ({ and: a })), or: vi.fn((...a: unknown[]) => ({ or: a })) };
    const table = { kind: 'kind', tagKeys: 'tag_keys', card: 'card' };
    expect(PluginReadRoutes.filterClause(db, table, route as any, { u: 'x' })).toBeUndefined();
    const one: any = PluginReadRoutes.filterClause(db, table, route as any, { kind: 'gift' });
    expect(one.or[0]).toEqual({ eq: ['kind', 'gift'] });
    expect(one.or).toHaveLength(2);
    expect((PluginReadRoutes.filterClause(db, table, route as any, { kind: 'gift', tag: 'new' }) as any).or[0]).toHaveProperty('and');
    const fixed: any = PluginReadRoutes.filterClause(db, table, { ...route, where: { kind: 'shop' } } as any, {});
    expect(fixed.or[0]).toEqual({ eq: ['kind', 'shop'] });
  });

  it('a field the collection does not have fails the read, so the plugin answers — never an empty list', async () => {
    const db: any = { eq: vi.fn(), and: vi.fn(), or: vi.fn(), desc: vi.fn() };
    expect(() => PluginReadRoutes.filterClause(db, { card: 'card' }, route as any, { tag: 'new' })).toThrow(/tagKeys/);
    expect(() => PluginReadRoutes.filterClause(db, { kind: 'kind' }, route as any, { kind: 'gift' })).toThrow(/card/);
    expect(() => PluginReadRoutes.order(db, { card: 'card', id: 'id' }, route as any, '-price')).toThrow(/price/);
    const { routes, find } = build();
    find.mockImplementationOnce(async (_c: any, read: any) => { CollectionReadOptions.of(read).where!(db, {}); return { docs: [] }; });
    const res = response();
    const next = vi.fn();
    routes.handle(request('/shop/items', { view: 'card', kind: 'gift' }), res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith());
    expect(res.json).not.toHaveBeenCalled();
  });
});
