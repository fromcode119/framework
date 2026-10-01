import { describe, expect, it } from 'vitest';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginGuestApiFactory } from '@core/plugin/host/plugin-guest-api-factory';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
import { ApiContextProxy } from '@core/plugin/context/api';

/**
 * A plugin in its own process declares `{ access, anonymousCache: true }` on a route. The flag must
 * reach the api's route unchanged, or the cache silently never applies — and must stay off for every
 * route that did not declare it.
 */
describe('a route\'s anonymous-cache opt-in, from the plugin process to the api', () => {
  it('the plugin process sends the flag with the route, true only when declared', () => {
    const sent: any[] = [];
    const factory = new PluginGuestApiFactory({ send: async (r: any) => { sent.push(r); } } as any, {} as any, { app: { get: () => undefined } } as any, { slug: 'shop', manifest: {} } as any);
    const api: any = factory.create();
    api.get('/products', { access: AccessLevel.PUBLIC, anonymousCache: true }, () => undefined);
    api.get('/cart', { access: AccessLevel.PUBLIC }, () => undefined);
    expect(sent.map((r) => [r.path, r.anonymousCache])).toEqual([['/shop/products', true], ['/shop/cart', false]]);
  });

  it('the api registers the route with the flag in its descriptor', () => {
    const calls: any[] = [];
    const registrations = new PluginHostRegistrations('shop', {} as any, async () => undefined, async () => undefined, {} as any, async () => undefined, () => true);
    const context: any = { api: { get: (path: string, ...handlers: any[]) => calls.push([path, handlers[0]]) } };
    const kind = String(PluginGuestRegistrationKind.ROUTE.value);
    registrations.apply(context, { kind, method: 'get', path: '/shop/products', access: { level: 'public' }, anonymousCache: true } as any);
    registrations.apply(context, { kind, method: 'get', path: '/shop/cart', access: { level: 'public' } } as any);
    expect(calls.map(([path, descriptor]) => [path, descriptor.anonymousCache])).toEqual([['products', true], ['cart', false]]);
  });

  it('the api puts the cache in front of every declared GET, never a POST', () => {
    const mounted: Record<string, number> = {};
    const manager: any = { plugins: new Map(), apiHost: {} };
    for (const method of ['get', 'post']) manager.apiHost[method] = (path: string, ...handlers: any[]) => { mounted[`${method} ${path}`] = handlers.length; };
    const security: any = { hasCapability: () => true, handleViolation: () => undefined, handleRateLimit: () => undefined };
    const api: any = ApiContextProxy.createApiProxy({ manifest: { slug: 'shop', version: '1' } } as any, manager, { debug: () => undefined } as any, security);
    api.get('products', { access: AccessLevel.PUBLIC, anonymousCache: true }, () => undefined);
    api.get('cart', { access: AccessLevel.PUBLIC }, () => undefined);
    api.post('orders', { access: AccessLevel.PUBLIC, anonymousCache: true }, () => undefined);
    // Every declared GET carries the cache, which steps aside unless the declaration opts in: a newer
    // process of the plugin may opt a mounted route in or out (plugin-host-route-redeclared.test.ts).
    expect(mounted['get /shop/products']).toBe(mounted['get /shop/cart']);
    expect(mounted['get /shop/cart'] - mounted['post /shop/orders']).toBe(1);
  });
});
