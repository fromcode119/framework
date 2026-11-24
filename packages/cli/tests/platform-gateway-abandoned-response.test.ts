import http from 'http';
import http2 from 'http2';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import type { AddressInfo } from 'net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { InternalServiceAuth } from '@fromcode119/core';
import { PlatformGateway } from '@cli/services/platform-gateway';

/**
 * 2026-11-24, 01:09-01:24 UTC: every storefront page hung while the api answered. A visitor that left in
 * the middle of a large page (an HTTP/2 stream cancelled, or its connection dropped) left the gateway's
 * connection to the frontend open with the rest of the page unread, forever. Each one held one of the
 * pool's sockets to the frontend; when the pool was full of them, every new page request waited for a
 * socket that never came. These tests hold the gateway to closing such a connection.
 */
class AbandonedFixture {
  static closers: Array<() => void> = [];
  static dir = '';

  static async upstreams(): Promise<{ api: number; frontend: number }> {
    const bundle = JSON.stringify({ certificates: [{ host: 'served.test', certificatePem: fs.readFileSync(path.join(AbandonedFixture.dir, 'c.pem'), 'utf8'), privateKeyPem: fs.readFileSync(path.join(AbandonedFixture.dir, 'k.pem'), 'utf8'), notAfter: new Date(Date.now() + 86_400_000).toISOString() }] });
    const api = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(bundle); });
    // A large page, sent in two parts: far more than fits in the socket buffers before the visitor leaves.
    const frontend = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.write('x'.repeat(256 * 1024));
      setTimeout(() => res.end('y'.repeat(1024 * 1024)), 50);
    });
    for (const server of [api, frontend]) {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      AbandonedFixture.closers.push(() => { server.closeAllConnections(); server.close(); });
    }
    return { api: (api.address() as AddressInfo).port, frontend: (frontend.address() as AddressInfo).port };
  }

  static async gateway(): Promise<PlatformGateway> {
    const ports = await AbandonedFixture.upstreams();
    process.env.PORT = '0';
    process.env.GATEWAY_TLS_PORT = '0';
    process.env.API_TARGET_URL = `http://127.0.0.1:${ports.api}`;
    process.env.FRONTEND_TARGET_URL = `http://127.0.0.1:${ports.frontend}`;
    const gateway = new PlatformGateway({ refresh: async () => null, resolveMap: async () => null, map: () => null, enabled: false, ageMs: 0, current: null } as any);
    gateway.start();
    await gateway.listener!.listening;
    await (gateway as any).tls.listener.listening;
    await (gateway as any).certificates.refresh();
    AbandonedFixture.closers.push(() => { void gateway.stop(0); delete process.env.GATEWAY_TLS_PORT; });
    return gateway;
  }

  /** Sockets the pool still counts as busy — a request in flight, or one nobody will ever finish. */
  static busy(gateway: PlatformGateway): number {
    const agent = (gateway as any).agent as http.Agent;
    return Object.values(agent.sockets).reduce((sum, list) => sum + (list?.length ?? 0), 0);
  }

  /** Waits for the pool to have no busy socket, or gives up and reports how many are left. */
  static async settle(gateway: PlatformGateway, ms = 3000): Promise<number> {
    const until = Date.now() + ms;
    while (Date.now() < until && AbandonedFixture.busy(gateway) > 0) await new Promise((resolve) => setTimeout(resolve, 50));
    return AbandonedFixture.busy(gateway);
  }

  /** An HTTP/2 visitor that reads the first part of the page and then cancels it, or drops the connection. */
  static h2Leave(gateway: PlatformGateway, how: 'cancel' | 'drop'): Promise<void> {
    const port = (gateway as any).tls.listener.port;
    return new Promise((resolve) => {
      const session = http2.connect(`https://127.0.0.1:${port}`, { servername: 'served.test', rejectUnauthorized: false });
      session.on('error', () => undefined);
      const stream = session.request({ ':path': '/big', ':authority': 'served.test' });
      stream.on('error', () => undefined);
      stream.once('data', () => {
        stream.pause();
        if (how === 'cancel') stream.close(http2.constants.NGHTTP2_CANCEL); else session.destroy();
        setTimeout(() => { session.destroy(); resolve(); }, 100);
      });
    });
  }

  /** An HTTP/2 visitor that cancels its page right after asking for it — before the frontend has answered. */
  static h2CancelEarly(gateway: PlatformGateway): Promise<void> {
    const port = (gateway as any).tls.listener.port;
    return new Promise((resolve) => {
      const session = http2.connect(`https://127.0.0.1:${port}`, { servername: 'served.test', rejectUnauthorized: false });
      session.on('error', () => undefined);
      const stream = session.request({ ':path': '/big', ':authority': 'served.test' });
      stream.on('error', () => undefined);
      stream.close(http2.constants.NGHTTP2_CANCEL);
      setTimeout(() => { session.destroy(); resolve(); }, 100);
    });
  }

  /** An ordinary HTTP/2 visitor: the whole page, and its status. */
  static h2Fetch(gateway: PlatformGateway): Promise<number> {
    const port = (gateway as any).tls.listener.port;
    return new Promise((resolve) => {
      const session = http2.connect(`https://127.0.0.1:${port}`, { servername: 'served.test', rejectUnauthorized: false });
      session.on('error', () => resolve(-2));
      const stream = session.request({ ':path': '/big', ':authority': 'served.test' });
      let status = 0;
      stream.on('response', (headers) => { status = Number(headers[':status']); });
      stream.on('error', () => resolve(-3));
      stream.on('end', () => { session.destroy(); resolve(status); });
      stream.resume();
    });
  }

  /** An HTTP/1.1 visitor that reads the first part of the page and then drops the connection. */
  static h1Leave(gateway: PlatformGateway): Promise<void> {
    return new Promise((resolve) => {
      const req = http.get({ host: '127.0.0.1', port: gateway.listener!.port, path: '/big', headers: { host: 'served.test' }, agent: false }, (res) => {
        res.once('data', () => { res.pause(); req.destroy(); setTimeout(resolve, 100); });
      });
      req.on('error', () => undefined);
    });
  }
}

describe('PlatformGateway — a visitor who leaves in the middle of a page', () => {
  beforeAll(() => {
    process.env[InternalServiceAuth.ENV_KEY] = process.env[InternalServiceAuth.ENV_KEY] || 'test-internal-secret';
    AbandonedFixture.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-abandon-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'k.pem', '-out', 'c.pem', '-days', '2', '-subj', '/CN=served.test', '-addext', 'subjectAltName=DNS:served.test'], { cwd: AbandonedFixture.dir, stdio: 'pipe' });
  });
  afterEach(() => { AbandonedFixture.closers.splice(0).forEach((close) => close()); });
  afterAll(() => { fs.rmSync(AbandonedFixture.dir, { recursive: true, force: true }); });

  it('closes the connection to the frontend when an HTTP/2 visitor cancels before the frontend answers', async () => {
    const gateway = await AbandonedFixture.gateway();
    for (let i = 0; i < 8; i++) await AbandonedFixture.h2CancelEarly(gateway);
    expect(await AbandonedFixture.settle(gateway)).toBe(0);
  }, 30000);

  it('closes the connection to the frontend when an HTTP/2 visitor cancels in the middle of the page', async () => {
    const gateway = await AbandonedFixture.gateway();
    for (let i = 0; i < 5; i++) await AbandonedFixture.h2Leave(gateway, 'cancel');
    for (let i = 0; i < 5; i++) await AbandonedFixture.h2Leave(gateway, 'drop');
    expect(await AbandonedFixture.settle(gateway)).toBe(0);
  }, 30000);

  it('closes the connection to the frontend when an HTTP/1.1 visitor drops its connection', async () => {
    const gateway = await AbandonedFixture.gateway();
    for (let i = 0; i < 5; i++) await AbandonedFixture.h1Leave(gateway);
    expect(await AbandonedFixture.settle(gateway)).toBe(0);
  }, 30000);

  it('still serves pages after more early cancels than the pool has sockets (the 2026-11-24 outage)', async () => {
    const gateway = await AbandonedFixture.gateway();
    const pool = ((gateway as any).agent as http.Agent).maxSockets;
    for (let batch = 0; batch < Math.ceil((pool + 20) / 20); batch++) {
      await Promise.all(Array.from({ length: 20 }, () => AbandonedFixture.h2CancelEarly(gateway)));
    }
    const started = Date.now();
    const status = await Promise.race([AbandonedFixture.h2Fetch(gateway), new Promise<number>((resolve) => setTimeout(() => resolve(-1), 5000))]);
    expect({ status, waitedUnder5s: Date.now() - started < 5000 }).toEqual({ status: 200, waitedUnder5s: true });
  }, 120000);
});
