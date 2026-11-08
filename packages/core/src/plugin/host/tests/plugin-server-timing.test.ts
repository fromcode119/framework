import http from 'http';
import os from 'os';
import path from 'path';
import express from 'express';
import type { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';
import { RequestServerTiming } from '@core/context/request-server-timing';
import { CookieConstants } from '@core/constants/cookie.constants';

/**
 * Where the time of a plugin route went, seen from the browser: the platform's own steps before the
 * plugin, the hop into its process, its handler. And who is NOT told — a signed-in caller, a write.
 */
describe('Server-Timing across the plugin process boundary', () => {
  let guest: PluginGuestHttp | null = null;
  let host: http.Server | null = null;
  afterEach(async () => {
    await guest?.close(); guest = null;
    await new Promise<void>((resolve) => (host ? host.close(() => resolve()) : resolve())); host = null;
  });

  const serve = async (): Promise<number> => {
    const socketPath = path.join(os.tmpdir(), `fc-guest-timing-${process.pid}-${Date.now()}.sock`);
    guest = new PluginGuestHttp(socketPath, {} as any);
    // A handler that sets a timing of its own (as the shop's product route does) and answers.
    guest.app.all('/answer', (_req, res) => { res.setHeader('Server-Timing', 'ecom-total;dur=3.0'); res.json({ ok: true }); });
    await guest.listen();
    const proxy = new PluginHostHttpProxy(socketPath);
    const app = express();
    app.use(RequestServerTiming.middleware({ gated: true, totalAs: 'api-total' }));
    app.use((req, res, next) => {
      RequestServerTiming.handlerReached();
      return proxy.forward(req, res, next, { token: 't', tenantId: null, locale: 'en', siteLocale: 'en', revision: '1', cacheMaxAgeMs: 0, targetPath: '/answer' }, 5000, () => undefined);
    });
    host = app.listen(0);
    await new Promise<void>((resolve) => host!.once('listening', () => resolve()));
    return (host.address() as AddressInfo).port;
  };

  const call = (port: number, method: string, headers: Record<string, string> = {}) => new Promise<{ status: number; timing: string | undefined }>((resolve, reject) => {
    const req = http.request({ port, path: '/', method, headers }, (reply) => {
      reply.resume();
      reply.on('end', () => resolve({ status: reply.statusCode ?? 0, timing: reply.headers['server-timing'] as string | undefined }));
    });
    req.on('error', reject);
    if (method !== 'GET') { req.setHeader('content-type', 'application/json'); req.write('{}'); }
    req.end();
  });

  it('tells an anonymous reader what the platform, the hop and the plugin each spent', async () => {
    const port = await serve();
    const { status, timing } = await call(port, 'GET');
    expect(status).toBe(200);
    const names = String(timing).split(',').map((part) => part.trim().split(';')[0]);
    expect(names).toEqual(expect.arrayContaining(['ecom-total', 'plugin-handler', 'plugin-upstream', 'api-pre', 'api-total']));
    for (const part of String(timing).split(',')) expect(part.trim()).toMatch(/^[a-z][a-z0-9-]*;dur=\d+(\.\d+)?(;desc="\d+x")?$/);
  });

  it('tells a signed-in caller nothing — not even what the plugin said itself', async () => {
    const port = await serve();
    for (const headers of [{ authorization: 'Bearer x' }, { cookie: `${CookieConstants.AUTH_COOKIES_TO_CLEAR[0]}=abc` }, { 'x-api-key': 'k' }]) {
      const { status, timing } = await call(port, 'GET', headers);
      expect(status).toBe(200);
      expect(timing).toBeUndefined();
    }
  });

  it('tells a write nothing', async () => {
    const port = await serve();
    const { status, timing } = await call(port, 'POST');
    expect(status).toBe(200);
    expect(timing).toBeUndefined();
  });
});
