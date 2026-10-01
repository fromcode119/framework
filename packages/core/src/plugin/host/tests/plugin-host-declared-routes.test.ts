import { afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import { PluginHostDeclaredRoutes } from '@core/plugin/host/plugin-host-declared-routes';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';

describe('PluginHostDeclaredRoutes', () => {
  const routes = new PluginHostDeclaredRoutes('shop');
  routes.add('get', '/shop/products/:slug');
  routes.add('post', '/shop/orders');

  it('matches a declared method and path under any prefix, params included', () => {
    expect(routes.declares('GET', '/api/v1/plugins/shop/products/bench-10')).toBe(true);
    expect(routes.declares('HEAD', '/api/v1/plugins/shop/products/bench-10')).toBe(true);
    expect(routes.declares('POST', '/api/v1/plugins/shop/orders')).toBe(true);
  });

  it('does not match another method, a longer or shorter path, or another plugin', () => {
    expect(routes.declares('POST', '/api/v1/plugins/shop/products/bench-10')).toBe(false);
    expect(routes.declares('GET', '/api/v1/plugins/shop/products/bench-10/reviews')).toBe(false);
    expect(routes.declares('GET', '/api/v1/plugins/shop/products')).toBe(false);
    expect(routes.declares('GET', '/api/v1/plugins/shopping/products/x')).toBe(false);
  });
});

/**
 * A shop's shape: a sub-router mounted at `/` BEFORE `GET /products/:slug` is declared. The
 * declared route's own layers (its gate, the response cache) must run for its requests; anything else
 * still goes to the catch-all.
 */
describe('a catch-all mounted before a declared route', () => {
  const servers: Array<{ close: () => void }> = [];
  afterAll(() => servers.forEach((s) => s.close()));

  it('lets the declared route answer its own requests, and the catch-all the rest', async () => {
    const registrations = new PluginHostRegistrations('shop', {} as any, async () => undefined, async () => undefined, {} as any, async () => undefined, () => true);
    (registrations as any).forwardRequest = (_req: express.Request, res: express.Response) => { res.setHeader('x-forwarded-by', res.getHeader('x-layer') ? 'declared-route' : 'catch-all'); res.json({ ok: true }); };
    const app = express();
    const router = express.Router();
    app.use('/api/v1/plugins', router);
    const context: any = {
      api: {
        use: (path: string, handler: any) => router.use(`/shop/${path}`, handler),
        // Stands in for the route's own layers (access gate, cache): marks that they ran.
        get: (path: string, ...handlers: any[]) => router.get(`/shop/${path}`, (_req: any, res: any, next: any) => { res.setHeader('x-layer', 'ran'); next(); }, ...handlers.filter((h) => typeof h === 'function')),
      },
    };
    const kind = (k: PluginGuestRegistrationKind) => String(k.value);
    registrations.apply(context, { kind: kind(PluginGuestRegistrationKind.USE), method: 'use', path: '/shop/' } as any);
    registrations.apply(context, { kind: kind(PluginGuestRegistrationKind.ROUTE), method: 'get', path: '/shop/products/:slug', access: { level: 'public' } } as any);
    const base = await new Promise<string>((resolve) => { const s = app.listen(0, () => resolve(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)); servers.push(s); });
    const via = async (path: string) => (await fetch(base + path)).headers.get('x-forwarded-by');
    expect(await via('/api/v1/plugins/shop/products/bench-10')).toBe('declared-route');
    expect(await via('/api/v1/plugins/shop/products/tags/extra')).toBe('catch-all');
    expect(await via('/api/v1/plugins/shop/purchase-count')).toBe('catch-all');
  });
});
