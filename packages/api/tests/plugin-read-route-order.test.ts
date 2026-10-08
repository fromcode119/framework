import { PluginState } from '@fromcode119/core';
import { PluginReadRoutes } from '@api/server/plugin-read-routes';

/**
 * A plugin may order its list by more than one field (pinned posts first, then the newest), and may read a
 * password from a header. A read route answers such a list in the plugin's own order, and leaves a request
 * carrying such a header to the plugin.
 */
describe('read route order and headers', () => {
  const route: any = {
    path: '/posts', collection: 'blog-posts', document: 'card',
    sorts: { sticky: { field: 'sticky' }, publishedAt: { field: 'publishedAt' } },
    defaultSort: '-sticky,-publishedAt',
    unlessHeaders: ['X-Post-Password'],
  };
  const table: any = { sticky: 'stickyCol', publishedAt: 'publishedCol', id: 'idCol', card: 'cardCol' };
  const db: any = { desc: (c: unknown) => ({ desc: c }) };

  it('orders by each default sort in turn, then the newest id', () => {
    expect(PluginReadRoutes.order(db, table, route, undefined)).toEqual([{ desc: 'stickyCol' }, { desc: 'publishedCol' }, { desc: 'idCol' }]);
  });

  it('a sort the request names replaces the defaults', () => {
    expect(PluginReadRoutes.order(db, table, route, '-publishedAt')).toEqual([{ desc: 'publishedCol' }, { desc: 'idCol' }]);
  });

  it('skips a default that is not a declared sort, and with none orders by the newest id', () => {
    expect(PluginReadRoutes.order(db, table, { ...route, defaultSort: '-sticky,-nope' }, undefined)).toEqual([{ desc: 'stickyCol' }, { desc: 'idCol' }]);
    expect(PluginReadRoutes.order(db, table, { ...route, defaultSort: undefined }, undefined)).toEqual([{ desc: 'idCol' }]);
  });

  it('answers only a limit the route accepts, and no limit at all', () => {
    const find = vi.fn(async () => ({ docs: [] }));
    const limited: any = { ...route, unlessHeaders: undefined, limitAccepts: '^[1-9]\\d*$' };
    const manager: any = {
      getPlugins: () => [{ state: PluginState.ACTIVE, manifest: { slug: 'blog', readRoutes: [limited] } }],
      registeredCollections: new Map([['x', { pluginSlug: 'blog', collection: { slug: 'blog-posts', fields: [] } }]]),
    };
    const routes = new PluginReadRoutes(manager, { find } as any);
    const declined = (query: Record<string, unknown>) => { const next = vi.fn(); routes.handle({ method: 'GET', path: '/blog/posts', query, headers: {} } as any, { set: vi.fn(), json: vi.fn() } as any, next); return next.mock.calls.length === 1; };
    for (const limit of ['0', '', '-5', '2.5', 'abc']) expect(declined({ limit }), limit).toBe(true);
    expect(find).not.toHaveBeenCalled();
    expect(declined({ limit: '20' })).toBe(false);
    expect(declined({})).toBe(false);
  });

  it('leaves a request that carries one of its headers to the plugin', () => {
    const find = vi.fn(async () => ({ docs: [] }));
    const manager: any = {
      getPlugins: () => [{ state: PluginState.ACTIVE, manifest: { slug: 'blog', readRoutes: [route] } }],
      registeredCollections: new Map([['x', { pluginSlug: 'blog', collection: { slug: 'blog-posts', fields: [] } }]]),
    };
    const routes = new PluginReadRoutes(manager, { find } as any);
    const next = vi.fn();
    routes.handle({ method: 'GET', path: '/blog/posts', query: {}, headers: { 'x-post-password': 'secret' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(find).not.toHaveBeenCalled();
  });
});
