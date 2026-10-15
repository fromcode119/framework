import { PluginState } from '@fromcode119/core';
import { PluginReadRoutes } from '@api/server/plugin-read-routes';
import { PluginReadRoutePrepared } from '@api/server/plugin-read-route-prepared';
import { CollectionReadOptions } from '@api/services/collection-read-options';

/**
 * A stored list once named its release in `where`, so right after a new release every stored document
 * (still stamped with the previous one) was filtered OUT and the list came back empty — every blog on the
 * platform said "Nothing published yet". A release named in `preparedBy` instead marks those documents
 * as not prepared: the plugin answers and stores them again.
 */
describe('PluginReadRoutes preparedBy', () => {
  const route = { path: '/posts', collection: 'posts', document: 'publicPost', preparedBy: { postRelease: '0.1.86' }, maxLimit: 50 };
  const collection: any = { slug: 'posts', fields: [] };
  const build = (docs: any[]) => {
    const find = vi.fn(async () => ({ docs }));
    const manager: any = {
      getPlugins: () => [{ state: PluginState.ACTIVE, manifest: { slug: 'cms', readRoutes: [route] } }],
      registeredCollections: new Map([['posts', { pluginSlug: 'cms', collection }]]),
    };
    return { routes: new PluginReadRoutes(manager, { find } as any), find };
  };
  const request = () => ({ method: 'GET', path: '/cms/posts', query: {} }) as any;
  const response = () => { const res: any = { headers: {} }; res.set = vi.fn(() => res); res.json = vi.fn(); res.status = vi.fn(() => res); return res; };

  it('answers documents kept by the release the route names, and reads the release with them', async () => {
    const { routes, find } = build([{ id: 2, publicPost: { title: 'B' }, postRelease: '0.1.86' }, { id: 1, publicPost: { title: 'A' }, postRelease: '0.1.86' }]);
    const res = response();
    const next = vi.fn();
    routes.handle(request(), res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(res.json).toHaveBeenCalledWith([{ title: 'B' }, { title: 'A' }]);
    expect(next).not.toHaveBeenCalled();
    expect(CollectionReadOptions.of((find.mock.calls[0] as any[])[1]).fields).toEqual(['publicPost', 'postRelease']);
  });

  it('sends the request to the plugin when a document on the page was kept by another release', async () => {
    const { routes } = build([{ id: 2, publicPost: { title: 'B' }, postRelease: '0.1.85' }, { id: 1, publicPost: { title: 'A' }, postRelease: '0.1.86' }]);
    const res = response();
    const next = vi.fn();
    routes.handle(request(), res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith());
    expect(res.json).not.toHaveBeenCalled();
  });

  it('counts a document as usable only when every preparedBy field matches and it is still fresh', () => {
    const fresh = { ...route, freshUntil: 'postValidUntil' };
    const now = Date.parse('2026-10-15T10:00:00Z');
    expect(PluginReadRoutePrepared.usable(fresh as any, { postRelease: '0.1.86', postValidUntil: '2026-10-16T00:00:00Z' }, now)).toBe(true);
    expect(PluginReadRoutePrepared.usable(fresh as any, { postRelease: '0.1.85', postValidUntil: '2026-10-16T00:00:00Z' }, now)).toBe(false);
    expect(PluginReadRoutePrepared.usable(fresh as any, { postRelease: '0.1.86', postValidUntil: '2026-10-14T00:00:00Z' }, now)).toBe(false);
    expect(PluginReadRoutePrepared.usable({ path: '/x', collection: 'x', document: 'd' } as any, {}, now)).toBe(true);
  });
});
