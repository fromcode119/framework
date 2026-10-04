import { afterAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { HookManager } from '@core/hooks/hook-manager';
import { PluginContextFactory } from '@core/plugin/context';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { MiddlewareManager } from '@core/plugin/services/runtime/middleware-manager';
import { MiddlewareStage } from '@core/enums/middleware-stage.enum';

/**
 * Production, 2026-09-27: a plugin update removed one of its middlewares. The replaced process's stand-in
 * stayed in the api, pointing at a handler the new process did not have, and every request on the sites
 * running the plugin got that process's 404 — a storefront served nothing until the api restarted.
 */
describe('a plugin process replaced by one that no longer registers a middleware', () => {
  it("leaves none of the old process's middleware standing — only what the new one registers", async () => {
    const hooks = new HookManager();
    const middlewares = new MiddlewareManager();
    const manager: any = { hooks, plugins: new Map(), db: {}, jobs: {}, logger: { child: () => ({}) }, middlewares, registeredCollections: new Map() };
    const logger: any = { child: () => ({ info() {}, warn() {}, error() {}, debug() {} }), info() {}, warn() {}, error() {}, debug() {} };
    const context = PluginContextFactory.createPluginContext({ manifest: { slug: 'probe', capabilities: ['api'] }, approvedCapabilities: ['api'] } as any, manager, logger);
    const registrations = new PluginHostRegistrations('probe', {} as any, async () => undefined, async () => undefined, {} as any, async () => undefined, () => true);
    const middleware = (id: string, handlerId: string) => ({ kind: String(PluginGuestRegistrationKind.MIDDLEWARE.value), handlerId, middleware: { id, stage: 'post_auth' } });
    registrations.apply(context, middleware('gate', 'h-old-1') as any);
    registrations.apply(context, middleware('stamp', 'h-old-2') as any);
    expect(middlewares.getByStage(MiddlewareStage.POST_AUTH).map((m) => m.id)).toEqual(['gate', 'stamp']);

    // The update: the new process registers `gate` again and no longer registers `stamp`.
    const next = new PluginGuestGeneration(2, { pid: 2, socketDir: '/tmp/probe.2', kill() {} } as any, { isClosed: false, pendingCount: 0, close() {}, request: async () => undefined } as any);
    next.described = { contractKeys: [], publicApiKeys: [], manifest: {} };
    next.held.push(middleware('gate', 'h-new-1') as any);
    const host = Object.create(PluginHost.prototype) as any;
    Object.assign(host, {
      slug: 'probe', guest: { pid: 1 }, channel: { isClosed: false }, generation: null, context, registrations, manager, logger,
      wasEnabled: false, restarts: 0, healthyTimer: null, proxy: { retarget() {}, inFlight: () => 0 }, limits: { timeoutMs: 1000 },
      invoke: async () => undefined, launchGeneration: async () => next,
    });

    await host.relaunch();

    expect(middlewares.getByStage(MiddlewareStage.POST_AUTH).map((m) => m.id)).toEqual(['gate']);
  });
});

describe("a plugin process asked for a middleware it does not have", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-mw-'));
  const socketPath = path.join(dir, 'routes.sock');
  const guest = new PluginGuestHttp(socketPath, {} as any);
  afterAll(async () => { await guest.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  const ask = (id: string) => new Promise<{ status: number; next: string | undefined }>((resolve, reject) => {
    const req = http.request({ socketPath, path: `${PluginGuestHttp.MIDDLEWARE_PATH}/${encodeURIComponent(id)}`, method: 'GET', headers: { [PluginGuestHttp.HEADER_ORIGINAL_URL]: '/api/v1/anything' } }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0, next: res.headers[PluginGuestHttp.HEADER_NEXT] as string | undefined }));
    });
    req.on('error', reject);
    req.end();
  });

  it('steps aside — the request goes on — instead of answering it with a 404', async () => {
    guest.mountMiddleware('known', (_req, res) => res.status(403).json({ error: 'gated' }));
    await guest.listen();
    expect(await ask('unknown')).toEqual({ status: 204, next: '1' });
    expect((await ask('known')).status).toBe(403);
  });
});
