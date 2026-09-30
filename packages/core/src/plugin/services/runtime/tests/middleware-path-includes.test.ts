import { describe, expect, it } from 'vitest';
import { MiddlewareManager } from '@core/plugin/services/runtime/middleware-manager';
import { MiddlewareStage } from '@core/enums/middleware-stage.enum';
import { PluginGuestApiFactory } from '@core/plugin/host/plugin-guest-api-factory';

/**
 * A middleware that guards two collections ran for EVERY api request — for a plugin in its own
 * process, one extra round trip on each of them. It can now name the paths it guards.
 */
describe('a middleware that names the paths it guards', () => {
  const dispatch = async (manager: MiddlewareManager, url: string) => {
    let reachedEnd = false;
    await manager.dispatch(MiddlewareStage.resolve('post_auth'), { originalUrl: url }, {}, () => { reachedEnd = true; });
    return reachedEnd;
  };

  it('runs only for those paths; a middleware that names none runs for every request', async () => {
    const manager = new MiddlewareManager();
    const ran: string[] = [];
    manager.register({ id: 'guard', stage: MiddlewareStage.resolve('post_auth'), pathIncludes: ['/collections/finance-wallets'], handler: (req: any, _res: any, next: any) => { ran.push(`guard ${req.originalUrl}`); next(); } });
    manager.register({ id: 'all', stage: MiddlewareStage.resolve('post_auth'), handler: (req: any, _res: any, next: any) => { ran.push(`all ${req.originalUrl}`); next(); } });
    expect(await dispatch(manager, '/api/v1/plugins/ecommerce/products')).toBe(true);
    expect(await dispatch(manager, '/api/v1/collections/finance-wallets/3')).toBe(true);
    expect(ran).toEqual(['all /api/v1/plugins/ecommerce/products', 'guard /api/v1/collections/finance-wallets/3', 'all /api/v1/collections/finance-wallets/3']);
  });

  it('a plugin in its own process sends the paths with the middleware', () => {
    const sent: any[] = [];
    const factory = new PluginGuestApiFactory({ send: async (r: any) => { sent.push(r); } } as any, { keep: () => 'h1' } as any, { mountMiddleware: () => undefined } as any, { slug: 'finance', manifest: {} } as any);
    (factory.create() as any).registerMiddleware({ id: 'guard', stage: 'post_auth', pathIncludes: ['/collections/finance-wallets'], handler: () => undefined });
    expect(sent[0].middleware.pathIncludes).toEqual(['/collections/finance-wallets']);
  });
});
