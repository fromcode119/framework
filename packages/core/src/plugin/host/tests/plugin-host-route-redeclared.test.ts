import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import { ApiContextProxy } from '@core/plugin/context/api';
import { ApiResponseCache } from '@core/plugin/context/api-response-cache';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

/**
 * Production, 0.2.274: the api took over the plugin process of the PREVIOUS release, restored its
 * registrations, then moved to the newer extension-host — whose process declared `GET /products` with
 * `anonymousCache`. Express mounts a route once and the host skipped the repeat, so the route kept the
 * old declaration and the response cache never engaged until the api restarted. The same held for the
 * access level: an update that made a public route admin-only left it public.
 */
describe('a route a newer plugin process declares differently', () => {
  const servers: Array<{ close: () => void }> = [];
  const gatewayBefore = process.env.ENFORCE_AUTHZ_GATEWAY;
  let base = '';
  let answered = 0;
  let registrations: PluginHostRegistrations;
  let context: any;

  beforeAll(async () => {
    process.env.ENFORCE_AUTHZ_GATEWAY = 'true';
    const plugin: any = { manifest: { slug: 'shop', version: '1.0.0' }, state: PluginState.ACTIVE };
    const router = express.Router();
    const manager: any = { apiHost: router, plugins: new Map([['shop', plugin]]) };
    const security: any = { hasCapability: () => true, handleViolation: () => undefined, handleRateLimit: () => undefined };
    context = { api: ApiContextProxy.createApiProxy(plugin, manager, { debug: () => undefined } as any, security) };
    registrations = new PluginHostRegistrations('shop', {} as any, async () => undefined, async () => undefined, {} as any, async () => undefined, () => true);
    (registrations as any).forwardRequest = (_req: express.Request, res: express.Response) => { answered += 1; res.json({ answered }); };
    const app = express();
    app.use('/api/v1/plugins', router);
    base = await new Promise<string>((resolve) => { const s = app.listen(0, () => resolve(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)); servers.push(s); });
  });
  afterEach(() => ApiResponseCache.reset());
  afterAll(() => {
    servers.forEach((s) => s.close());
    if (gatewayBefore === undefined) delete process.env.ENFORCE_AUTHZ_GATEWAY; else process.env.ENFORCE_AUTHZ_GATEWAY = gatewayBefore;
  });

  const declare = (path: string, access: unknown, anonymousCache?: boolean) => registrations.apply(context, {
    kind: String(PluginGuestRegistrationKind.ROUTE.value), method: 'get', path, access, anonymousCache,
  } as any);
  const get = async (path: string) => {
    const res = await fetch(`${base}/api/v1/plugins/shop/${path}`);
    return { status: res.status, cache: res.headers.get(ApiResponseCache.STATUS_HEADER) };
  };

  it('starts caching once the newer process opts the route in', async () => {
    ApiResponseCache.useMaxAge(() => 60);
    declare('/shop/products', { level: 'public' });
    expect((await get('products')).cache).toBeNull();

    declare('/shop/products', { level: 'public' }, true);
    expect([(await get('products')).cache, (await get('products')).cache]).toEqual(['miss', 'hit']);

    declare('/shop/products', { level: 'public' }, false);
    expect((await get('products')).cache).toBeNull();
  });

  it('enforces the access level the newer process declares, both ways', async () => {
    declare('/shop/report', { level: 'public' });
    expect((await get('report')).status).toBe(200);

    declare('/shop/report', { level: 'admin' });
    expect((await get('report')).status).not.toBe(200);

    declare('/shop/report', { level: 'public' });
    expect((await get('report')).status).toBe(200);
  });
});
