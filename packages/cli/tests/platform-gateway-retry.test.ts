import http from 'http';
import type { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import { PlatformGateway } from '@cli/services/platform-gateway';

/**
 * During a rolling deploy the old app closes the connection a request was about to use. For a request
 * with no body the gateway tries again on a fresh connection instead of answering 502; a request with
 * a body is never replayed, because the gateway cannot know whether the app acted on it.
 */
class RetryFixture {
  static closers: Array<() => void> = [];

  /** An upstream that drops the connection of its first `drops` requests, then answers. */
  static async upstream(drops: number): Promise<{ port: number; seen: () => number }> {
    let seen = 0;
    const server = http.createServer((_req, res) => {
      seen += 1;
      if (seen <= drops) { res.socket?.destroy(); return; }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('served');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    RetryFixture.closers.push(() => server.close());
    return { port: (server.address() as AddressInfo).port, seen: () => seen };
  }

  static async gateway(upstreamPort: number): Promise<number> {
    process.env.PORT = '0';
    process.env.API_TARGET_URL = `http://127.0.0.1:${upstreamPort}`;
    process.env.FRONTEND_TARGET_URL = `http://127.0.0.1:${upstreamPort}`;
    const gateway = new PlatformGateway({ refresh: async () => null, resolveMap: async () => null, map: () => null, enabled: false, ageMs: 0 } as any);
    gateway.start();
    const server = gateway.server as http.Server;
    await new Promise<void>((resolve) => (server.listening ? resolve() : server.once('listening', () => resolve())));
    RetryFixture.closers.push(() => server.close());
    return (server.address() as AddressInfo).port;
  }

  static request(port: number, method: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, method, path: '/shop', headers: { host: 'platform.test' }, agent: false }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on('error', reject);
      req.end(method === 'POST' ? '{"a":1}' : undefined);
    });
  }
}

describe('PlatformGateway retry', () => {
  afterEach(() => { RetryFixture.closers.splice(0).forEach((close) => close()); });

  it('serves a GET whose first connection was dropped by the app', async () => {
    const upstream = await RetryFixture.upstream(1);
    const port = await RetryFixture.gateway(upstream.port);

    expect(await RetryFixture.request(port, 'GET')).toEqual({ status: 200, body: 'served' });
    expect(upstream.seen()).toBe(2);
  });

  it('gives up after two retries rather than looping', async () => {
    const upstream = await RetryFixture.upstream(10);
    const port = await RetryFixture.gateway(upstream.port);

    expect((await RetryFixture.request(port, 'GET')).status).toBe(502);
    expect(upstream.seen()).toBe(3);
  });

  it('never replays a POST', async () => {
    const upstream = await RetryFixture.upstream(1);
    const port = await RetryFixture.gateway(upstream.port);

    expect((await RetryFixture.request(port, 'POST')).status).toBe(502);
    expect(upstream.seen()).toBe(1);
  });
});
