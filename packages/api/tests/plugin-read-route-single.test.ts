import { ApiResponseCache, PluginState, RequestContextUtils } from '@fromcode119/core';
import { PluginReadRoutePath } from '@api/server/plugin-read-route-path';
import { PluginReadRoutes } from '@api/server/plugin-read-routes';
import { CollectionReadOptions } from '@api/services/collection-read-options';

/**
 * A product page cost a trip into the plugin's process on every request, though the plugin could keep the
 * finished page beside the product. A read route with a named path segment answers that one record's
 * document, and only that one — and only while the document is exact and in the language asked for.
 */
describe('a read route that answers one record', () => {
  const route: any = {
    path: '/items/:slug',
    collection: 'shop-items',
    document: 'page',
    freshUntil: 'pageUntil',
    single: true,
    documentByLocale: true,
    params: { slug: { field: 'slug', accepts: '^[\\p{L}\\p{Nd}_-]+$' } },
    unless: ['currency'],
    where: { listed: true },
  };
  const collection: any = { slug: 'shop-items', fields: [] };
  const future = () => new Date(Date.now() + 60_000).toISOString();

  const build = (docs: any[]) => {
    const find = vi.fn(async () => ({ docs }));
    const manager: any = {
      getPlugins: () => [{ state: PluginState.ACTIVE, manifest: { slug: 'shop', readRoutes: [route] } }],
      registeredCollections: new Map([['x', { pluginSlug: 'shop', collection }]]),
    };
    return { routes: new PluginReadRoutes(manager, { find } as any), find };
  };
  const response = () => { const res: any = { headers: {} as Record<string, string> }; res.set = vi.fn((k: string, v: string) => { res.headers[k] = v; return res; }); res.json = vi.fn(); res.status = vi.fn(() => res); return res; };
  const ask = async (routes: PluginReadRoutes, path: string, query: Record<string, string> = {}, locale = 'bg') => {
    const res = response();
    const next = vi.fn();
    await RequestContextUtils.storage.run({ locale } as any, async () => {
      routes.handle({ method: 'GET', path, query } as any, res, next);
      await vi.waitFor(() => expect(res.json.mock.calls.length + next.mock.calls.length).toBeGreaterThan(0));
    });
    return { res, next };
  };

  describe('the path', () => {
    it('reads the named segment, decoded', () => {
      expect(PluginReadRoutePath.match(route, '/items/blue-mug')).toEqual({ slug: 'blue-mug' });
      expect(PluginReadRoutePath.match(route, '/ITEMS/%D1%87%D0%B0%D1%88%D0%B0')).toEqual({ slug: 'чаша' });
    });

    it('declines what is not the route, a segment that is not accepted, or a path with a further segment', () => {
      expect(PluginReadRoutePath.match(route, '/items')).toBeNull();
      expect(PluginReadRoutePath.match(route, '/items/a/b')).toBeNull();
      expect(PluginReadRoutePath.match(route, '/items/bad.slug')).toBeNull();
      expect(PluginReadRoutePath.match(route, '/items/%E0%A4%A')).toBeNull();
    });

    it('still matches a plain path whatever its case', () => {
      expect(PluginReadRoutePath.match({ path: '/Items' } as any, '/items')).toEqual({});
      expect(PluginReadRoutePath.match({ path: '/items' } as any, '/other')).toBeNull();
    });
  });

  it('answers the record\'s document in the request\'s language, from the stored page alone', async () => {
    const { routes, find } = build([{ id: 7, page: { bg: { name: 'Чаша' }, en: { name: 'Mug' } }, pageUntil: future() }]);
    const { res, next } = await ask(routes, '/shop/items/mug', {}, 'en');
    expect(res.json).toHaveBeenCalledWith({ name: 'Mug' });
    expect(next).not.toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('private, no-store');
    const [, read] = find.mock.calls[0] as any[];
    expect(read.query).toEqual({ limit: '1' });
    expect(CollectionReadOptions.of(read)).toMatchObject({ fields: ['page', 'pageUntil'], withoutTotal: true });
  });

  it('leaves it to the plugin when the language has no entry — never another language\'s wording', async () => {
    const { routes } = build([{ id: 7, page: { bg: { name: 'Чаша' } }, pageUntil: future() }]);
    const { res, next } = await ask(routes, '/shop/items/mug', {}, 'en');
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('leaves it to the plugin when there is no record, no document, or the document is past its moment', async () => {
    for (const docs of [[], [{ id: 7, page: null, pageUntil: future() }], [{ id: 7, page: { bg: { name: 'x' } }, pageUntil: new Date(Date.now() - 1000).toISOString() }], [{ id: 7, page: { bg: { name: 'x' } }, pageUntil: null }]]) {
      const { routes } = build(docs);
      const { res, next } = await ask(routes, '/shop/items/mug');
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    }
  });

  it('does not answer a request that names a query the route cannot honour', async () => {
    const { routes, find } = build([{ id: 7, page: { bg: { name: 'x' } }, pageUntil: future() }]);
    const { next } = await ask(routes, '/shop/items/mug', { currency: 'USD' });
    expect(next).toHaveBeenCalledWith();
    expect(find).not.toHaveBeenCalled();
  });

  it('reads only the record named, with the route\'s fixed conditions — no other record is a candidate', () => {
    const db: any = { eq: vi.fn((c: unknown, v: unknown) => ({ eq: [c, v] })), and: vi.fn((...x: unknown[]) => ({ and: x })) };
    const clause: any = PluginReadRoutes.recordClause(db, { listed: 'listed', slug: 'slug_col' }, route, { slug: 'mug' });
    expect(clause).toEqual({ and: [{ eq: ['listed', true] }, { eq: ['slug_col', 'mug'] }] });
  });

  describe('an anonymous answer kept like the plugin\'s own routes', () => {
    afterEach(() => ApiResponseCache.reset());

    it('is built once, and the repeat is the kept answer — not a read of the record', async () => {
      ApiResponseCache.useMaxAge(() => 60);
      const cached = { ...route, anonymousCache: true };
      const find = vi.fn(async () => ({ docs: [{ id: 7, page: { bg: { name: 'Чаша' } }, pageUntil: future() }] }));
      const plugin: any = { state: PluginState.ACTIVE, manifest: { slug: 'shop', version: '1.0.0', readRoutes: [cached] } };
      const manager: any = { getPlugins: () => [plugin], registeredCollections: new Map([['x', { pluginSlug: 'shop', collection }]]) };
      const routes = new PluginReadRoutes(manager, { find } as any);
      const answer = async () => {
        const headers: Record<string, string> = {};
        const chunks: string[] = [];
        const res: any = {
          statusCode: 200,
          set: (k: string, v: string) => { headers[k.toLowerCase()] = v; return res; },
          setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
          getHeader: (k: string) => headers[k.toLowerCase()],
          status: (code: number) => { res.statusCode = code; return res; },
          write: (c: unknown) => { chunks.push(String(c)); return true; },
          end: (c?: unknown) => { if (c) chunks.push(String(c)); res.finished = true; return res; },
          json: (v: unknown) => { headers['content-type'] = 'application/json'; res.end(JSON.stringify(v)); },
        };
        const req: any = { method: 'GET', path: '/shop/items/mug', originalUrl: '/api/v1/plugins/shop/items/mug', url: '/items/mug', query: {}, headers: {} };
        await RequestContextUtils.storage.run({ locale: 'bg' } as any, async () => {
          routes.handle(req, res, vi.fn());
          await vi.waitFor(() => expect(res.finished).toBe(true));
        });
        return { headers, body: chunks.join('') };
      };
      const first = await answer();
      const second = await answer();
      expect(find).toHaveBeenCalledTimes(1);
      expect(first.headers['x-fc-api-cache']).toBe('miss');
      expect(second.headers['x-fc-api-cache']).toBe('hit');
      expect(second.body).toBe(first.body);
      expect(JSON.parse(second.body)).toEqual({ name: 'Чаша' });
    });
  });
});

describe('a read route whose document is also keyed by a variant', () => {
  const route: any = {
    path: '/items/:slug', collection: 'shop-items', document: 'page', freshUntil: 'pageUntil', single: true, documentByLocale: true,
    documentVariant: { param: 'currency', accepts: '^[A-Za-z]{3}$' },
    params: { slug: { field: 'slug', accepts: '^[a-z-]+$' } },
  };
  const list: any = { path: '/items', collection: 'shop-items', document: 'page', freshUntil: 'pageUntil', documentByLocale: true, documentVariant: route.documentVariant };
  const collection: any = { slug: 'shop-items', fields: [] };
  const future = () => new Date(Date.now() + 60_000).toISOString();
  const page = { bg: { name: 'Чаша' }, 'bg:EUR': { name: 'Чаша €' } };

  const run = async (routeUnder: any, path: string, query: Record<string, string>, docs: any[]) => {
    const manager: any = {
      getPlugins: () => [{ state: PluginState.ACTIVE, manifest: { slug: 'shop', readRoutes: [routeUnder] } }],
      registeredCollections: new Map([['x', { pluginSlug: 'shop', collection }]]),
    };
    const routes = new PluginReadRoutes(manager, { find: vi.fn(async () => ({ docs })) } as any);
    const res: any = { set: vi.fn(() => res), json: vi.fn(), status: vi.fn(() => res) };
    const next = vi.fn();
    await RequestContextUtils.storage.run({ locale: 'bg' } as any, async () => {
      routes.handle({ method: 'GET', path, query } as any, res, next);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    return { res, next };
  };

  it('answers the variant\'s entry, or the plain language entry when none is named', async () => {
    const docs = [{ id: 1, page, pageUntil: future() }];
    expect((await run(route, '/shop/items/mug', { currency: 'eur' }, docs)).res.json).toHaveBeenCalledWith({ name: 'Чаша €' });
    expect((await run(route, '/shop/items/mug', {}, docs)).res.json).toHaveBeenCalledWith({ name: 'Чаша' });
  });

  it('leaves a variant with no entry, or one the route does not accept, to the plugin', async () => {
    const docs = [{ id: 1, page, pageUntil: future() }];
    for (const currency of ['usd', 'EURO', '<x>']) {
      const { res, next } = await run(route, '/shop/items/mug', { currency }, docs);
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    }
  });

  it('picks the language\'s entry of every record on a list, never the whole map', async () => {
    const docs = [{ id: 1, page, pageUntil: future() }, { id: 2, page: { bg: { name: 'Нож' }, 'bg:EUR': { name: 'Нож €' } }, pageUntil: future() }];
    expect((await run(list, '/shop/items', {}, docs)).res.json).toHaveBeenCalledWith([{ name: 'Чаша' }, { name: 'Нож' }]);
    expect((await run(list, '/shop/items', { currency: 'EUR' }, docs)).res.json).toHaveBeenCalledWith([{ name: 'Чаша €' }, { name: 'Нож €' }]);
    const missing = await run(list, '/shop/items', {}, [...docs, { id: 3, page: { en: { name: 'Knife' } }, pageUntil: future() }]);
    expect(missing.res.json).not.toHaveBeenCalled();
    expect(missing.next).toHaveBeenCalled();
  });
});
