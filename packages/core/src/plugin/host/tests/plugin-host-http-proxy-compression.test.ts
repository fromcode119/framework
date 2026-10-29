import http from 'http';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import express from 'express';
import type { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';

/**
 * A plugin's answer streams back through the host's proxy and never passes the api's `res.json`, so
 * the api's JSON compression never reached it: a 186 KB catalogue went out as 186 KB.
 */
describe('the plugin proxy compressing a JSON answer', () => {
  let guest: PluginGuestHttp | null = null;
  let host: http.Server | null = null;
  afterEach(async () => {
    await guest?.close(); guest = null;
    await new Promise<void>((resolve) => (host ? host.close(() => resolve()) : resolve())); host = null;
  });

  const serve = async (body: unknown): Promise<number> => {
    const socketPath = path.join(os.tmpdir(), `fc-guest-gzip-${process.pid}-${Date.now()}.sock`);
    guest = new PluginGuestHttp(socketPath, {} as any);
    guest.app.get('/answer', (_req, res) => res.json(body));
    await guest.listen();
    const proxy = new PluginHostHttpProxy(socketPath);
    const app = express();
    app.use((req, res, next) => proxy.forward(req, res, next, {
      token: 't', tenantId: null, locale: 'en', siteLocale: 'en', revision: '1', cacheMaxAgeMs: 0, targetPath: '/answer',
    }, 5000, () => undefined));
    host = app.listen(0);
    await new Promise<void>((resolve) => host!.once('listening', () => resolve()));
    return (host.address() as AddressInfo).port;
  };

  const get = (port: number, headers: Record<string, string>) => new Promise<{ encoding?: string; raw: Buffer }>((resolve, reject) => {
    http.get({ port, path: '/', headers }, (reply) => {
      const chunks: Buffer[] = [];
      reply.on('data', (chunk) => chunks.push(chunk));
      reply.on('end', () => resolve({ encoding: reply.headers['content-encoding'] as string | undefined, raw: Buffer.concat(chunks) }));
    }).on('error', reject);
  });

  const large = { words: Array.from({ length: 400 }, (_, i) => `word number ${i}`) };

  it('gzips a large answer for a client that accepts it', async () => {
    const port = await serve(large);
    const reply = await get(port, { 'accept-encoding': 'gzip' });
    expect(reply.encoding).toBe('gzip');
    expect(JSON.parse(zlib.gunzipSync(reply.raw).toString('utf8'))).toEqual(large);
  });

  it('sends it plain to a client that does not accept gzip', async () => {
    const port = await serve(large);
    const reply = await get(port, {});
    expect(reply.encoding).toBeUndefined();
    expect(JSON.parse(reply.raw.toString('utf8'))).toEqual(large);
  });

  it('sends it plain when it holds the caller\'s bearer token', async () => {
    const token = 'secret-bearer-token-value';
    const port = await serve({ ...large, echo: token });
    const reply = await get(port, { 'accept-encoding': 'gzip', authorization: `Bearer ${token}` });
    expect(reply.encoding).toBeUndefined();
    expect(JSON.parse(reply.raw.toString('utf8')).echo).toBe(token);
  });
});
