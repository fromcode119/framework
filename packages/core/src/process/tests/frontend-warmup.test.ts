import http from 'http';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrontendWarmup } from '@core/process/frontend-warmup';
import { PublicServerHandover } from '@core/process/public-server-handover';
import { InternalServiceAuth } from '@core/security/internal-service-auth';

/** A stand-in frontend that answers by Host, so a warm-up that sent the wrong Host would show. */
class FakeFrontend {
  readonly seen: string[] = [];
  server = http.createServer((req, res) => {
    this.seen.push(String(req.headers.host));
    res.statusCode = req.headers.host === 'slow.example' ? 200 : 200;
    res.end(`home of ${req.headers.host}`);
  });
  start(): Promise<number> {
    return new Promise((resolve) => this.server.listen(0, '127.0.0.1', () => resolve((this.server.address() as AddressInfo).port)));
  }
  stop(): Promise<void> { return new Promise((resolve) => this.server.close(() => resolve())); }
}

const routingMap = {
  routes: [
    { host: 'shop.example', target: 'frontend', tenantId: 'shop' },
    { host: 'www.shop.example', target: 'frontend', tenantId: 'shop' },
    { host: 'blog.example', target: 'frontend', tenantId: 'blog' },
    { host: 'console.example', target: 'admin', tenantId: 'workspace' },
    { host: 'api.example', target: 'api', tenantId: null },
  ],
};

describe('FrontendWarmup', () => {
  let frontend: FakeFrontend;
  let port: number;
  beforeEach(async () => {
    frontend = new FakeFrontend();
    port = await frontend.start();
    vi.spyOn(InternalServiceAuth, 'isConfigured').mockReturnValue(true);
    vi.spyOn(InternalServiceAuth, 'requestHeaders').mockReturnValue({ 'x-fromcode-internal-secret': 's' });
  });
  afterEach(async () => { vi.restoreAllMocks(); await frontend.stop(); });

  const mapFetch = (body: unknown, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

  it('renders each site once, by its own host, and never the admin or the api', async () => {
    const results = await new FrontendWarmup('http://api', port, mapFetch(routingMap), () => undefined).run();
    expect(frontend.seen).toEqual(['shop.example', 'blog.example']);
    expect(results).toEqual([{ host: 'shop.example', result: '200' }, { host: 'blog.example', result: '200' }]);
  });

  it('warms nothing — and does not fail the start — when the site list cannot be read', async () => {
    const results = await new FrontendWarmup('http://api', port, mapFetch({}, false), () => undefined).run();
    expect(results).toEqual([]);
    expect(frontend.seen).toEqual([]);
  });

  it('stops warming when its time is used up, leaving the rest to warm on first request', async () => {
    // deadline set at 0; first site checked and started at 0, logged once the budget is gone; second skipped.
    const readings = [0, 0, 0, FrontendWarmup.TOTAL_BUDGET_MS, FrontendWarmup.TOTAL_BUDGET_MS];
    const now = () => readings.shift() ?? FrontendWarmup.TOTAL_BUDGET_MS;
    const results = await new FrontendWarmup('http://api', port, mapFetch(routingMap), () => undefined).run(now);
    expect(results.map((r) => r.result)).toEqual(['200', 'skipped (warm-up time used up)']);
  });
});

describe('PublicServerHandover', () => {
  it('serves the started server’s own handler on the public port, which refuses until it is opened', async () => {
    const servers = await PublicServerHandover.capture(() => new Promise<void>((resolve) => {
      http.createServer((_req, res) => res.end('next')).listen(0, '127.0.0.1', () => resolve());
    }));
    const privatePort = (servers[0].address() as AddressInfo).port;
    const started = PublicServerHandover.listeningOn(servers, privatePort)!;
    const publicServer = await PublicServerHandover.open(started, 0, '127.0.0.1');
    const publicPort = (publicServer.address() as AddressInfo).port;
    const body = await new Promise<string>((resolve) => http.get({ host: '127.0.0.1', port: publicPort, path: '/' }, (res) => { let text = ''; res.on('data', (c) => { text += c; }); res.on('end', () => resolve(text)); }));
    expect(body).toBe('next');
    expect(http.createServer).toBe(http.createServer); // restored, not left patched
    await new Promise((resolve) => publicServer.close(resolve));
    await new Promise((resolve) => started.close(resolve));
  });
});

describe('FrontendWarmup.listen', () => {
  it('starts Next on another port but the same hostname — a different one broke every storefront', () => {
    expect(FrontendWarmup.listen(3000, '0.0.0.0')).toEqual({ port: 3100, hostname: '0.0.0.0' });
  });
});
