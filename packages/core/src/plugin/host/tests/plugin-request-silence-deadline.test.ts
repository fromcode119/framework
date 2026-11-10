import http from 'http';
import os from 'os';
import path from 'path';
import express from 'express';
import type { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';

/**
 * A checkout of 48 lines took 30 s of stock writes and emails, every one a call back to the host, and the
 * fixed deadline cut it off before its order existed. The deadline is on the request's silence.
 */
describe('a plugin request deadline counted on the request\'s own silence', () => {
  let guest: PluginGuestHttp | null = null;
  let host: http.Server | null = null;
  afterEach(async () => {
    await guest?.close(); guest = null;
    await new Promise<void>((resolve) => (host ? host.close(() => resolve()) : resolve())); host = null;
  });

  const serve = async (answerAfterMs: number, quietForMs: () => number, onTimeout: () => void): Promise<number> => {
    const socketPath = path.join(os.tmpdir(), `fc-guest-quiet-${process.pid}-${Date.now()}.sock`);
    guest = new PluginGuestHttp(socketPath, {} as any);
    guest.app.post('/checkout', (_req, res) => { setTimeout(() => res.json({ ok: true }), answerAfterMs); });
    await guest.listen();
    const proxy = new PluginHostHttpProxy(socketPath);
    const app = express();
    app.use((req, res, next) => proxy.forward(req, res, next, {
      token: 't', tenantId: null, locale: 'en', siteLocale: 'en', revision: '1', cacheMaxAgeMs: 0, targetPath: '/checkout',
    }, 100, onTimeout, quietForMs));
    host = app.listen(0);
    await new Promise<void>((resolve) => host!.once('listening', () => resolve()));
    return (host.address() as AddressInfo).port;
  };

  const post = (port: number) => new Promise<number>((resolve, reject) => {
    const request = http.request({ port, path: '/', method: 'POST' }, (reply) => { reply.resume(); reply.on('end', () => resolve(reply.statusCode ?? 0)); });
    request.on('error', reject);
    request.end();
  });

  it('lets a request that keeps calling the host run past the deadline', async () => {
    let restarted = false;
    const port = await serve(350, () => 0, () => { restarted = true; });
    expect(await post(port)).toBe(200);
    expect(restarted).toBe(false);
  });

  it('still cuts off a request that has gone quiet, and restarts the guest', async () => {
    let restarted = false;
    const port = await serve(1000, () => Infinity, () => { restarted = true; });
    expect(await post(port)).toBe(504);
    expect(restarted).toBe(true);
  });

  it('counts a token as active while one of its host calls runs, and quiet from when it ended', async () => {
    const tokens = new PluginInvocationTokens();
    const token = tokens.mint('route', undefined);
    let during = -1;
    await tokens.track(token, async () => { await new Promise((r) => setTimeout(r, 30)); during = tokens.quietForMs(token); });
    expect(during).toBe(0);
    expect(tokens.quietForMs(token, Date.now() + 500)).toBeGreaterThanOrEqual(500);
    tokens.revoke(token);
    expect(tokens.quietForMs(token)).toBe(Infinity);
  });
});
