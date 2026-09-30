import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';

/**
 * A plugin learns the visitor's address from the PLATFORM, never from a header the visitor wrote.
 *
 * The host proxy used to copy every client header and then overwrite only some of its private ones, so
 * `x-fc-original-url` and `x-fc-raw-body` from a client reached the guest untouched. It now deletes a
 * client's copy of every private header first, and sends the address `NetworkAddressUtils` resolved.
 */
describe('the visitor address a sandboxed plugin sees', () => {
  const sockets: string[] = [];
  const closers: Array<() => Promise<void>> = [];
  const socket = (name: string): string => {
    const file = path.join(os.tmpdir(), `fc-${name}-${process.pid}-${Date.now()}-${sockets.length}.sock`);
    sockets.push(file);
    return file;
  };
  afterEach(async () => {
    for (const close of closers.splice(0)) await close();
    for (const file of sockets.splice(0)) fs.rmSync(file, { force: true });
  });

  it('the host sends the address it resolved, and drops every private header the client wrote', async () => {
    const upstreamSocket = socket('upstream');
    const upstream = http.createServer((req, res) => res.end(JSON.stringify(req.headers)));
    await new Promise<void>((resolve) => upstream.listen(upstreamSocket, resolve));
    closers.push(() => new Promise<void>((resolve) => upstream.close(() => resolve())));

    const proxy = new PluginHostHttpProxy(upstreamSocket);
    const host = express();
    host.get('/p', (req, res, next) => {
      void proxy.forward(req, res, next, { token: 't', tenantId: 'site', locale: 'en', siteLocale: 'en' }, 5000, () => undefined);
    });

    const reply = await request(host).get('/p')
      .set(PluginGuestHttp.HEADER_CLIENT_IP, '6.6.6.6')
      .set(PluginGuestHttp.HEADER_ORIGINAL_URL, '/admin/secret')
      .set(PluginGuestHttp.HEADER_RAW_BODY, '1')
      .set('x-forwarded-for', '7.7.7.7');
    const seen = JSON.parse(reply.text);

    expect(seen[PluginGuestHttp.HEADER_CLIENT_IP]).toBe('127.0.0.1');
    expect(seen[PluginGuestHttp.HEADER_ORIGINAL_URL]).toBeUndefined();
    expect(seen[PluginGuestHttp.HEADER_RAW_BODY]).toBeUndefined();
    expect(seen[PluginGuestHttp.HEADER_TENANT]).toBe('site');
  });

  it('the guest exposes it as req.clientIp and keeps no private header on the request', async () => {
    const guestSocket = socket('guest');
    const guest = new PluginGuestHttp(guestSocket, {} as any);
    guest.app.get('/who', (req: any, res) => res.json({ clientIp: req.clientIp, header: req.headers[PluginGuestHttp.HEADER_CLIENT_IP] ?? null }));
    await guest.listen();
    closers.push(() => guest.close());

    const seen = await new Promise<any>((resolve, reject) => {
      const req = http.request({ socketPath: guestSocket, method: 'GET', path: '/who', headers: { [PluginGuestHttp.HEADER_CLIENT_IP]: '203.0.113.9' } }, (reply) => {
        let text = '';
        reply.on('data', (chunk) => { text += chunk; });
        reply.on('end', () => resolve(JSON.parse(text)));
      });
      req.on('error', reject);
      req.end();
    });

    expect(seen).toEqual({ clientIp: '203.0.113.9', header: null });
  });
});
