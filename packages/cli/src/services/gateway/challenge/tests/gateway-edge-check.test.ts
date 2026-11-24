import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'http';
import { EdgeProtection, TenantRouteMap } from '@fromcode119/core';
import { GatewayEdgeCheck } from '@cli/services/gateway/challenge/gateway-edge-check';
import { GatewayChallenge } from '@cli/services/gateway/challenge/gateway-challenge';
import { GatewayRateLimit } from '@cli/services/gateway/challenge/gateway-rate-limit';
import { GatewayVisitorRules } from '@cli/services/gateway/challenge/gateway-visitor-rules';
import { GatewayRefusalLog } from '@cli/services/gateway/challenge/gateway-refusal-log';
import { GatewayScannerBan } from '@cli/services/gateway/challenge/gateway-scanner-ban';
import { GatewayEdgeReporter } from '@cli/services/gateway/challenge/gateway-edge-reporter';

/** The gateway's edge check in front of a stub app, with a routing map that knows one site. */
describe('GatewayEdgeCheck — requests per visitor', () => {
  const map = TenantRouteMap.fromJson({
    routes: [{ host: 'shop.test', target: 'frontend', tenantId: 'shop' }],
    protection: new EdgeProtection([], 0, ['/api/'], '', '', 2, true, ['/.env'], ['sqlmap']).toJSON(),
  });
  const check = new GatewayEdgeCheck(async () => map, (req) => String(req.headers.host || ''));
  let server: http.Server;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      // As if a visitor on the public internet, the way the PROXY header presents them.
      Object.defineProperty(req.socket, 'remoteAddress', { value: String(req.headers['x-test-visitor']), configurable: true });
      void check.handle(req, res).then((answered) => { if (!answered) res.end('through'); });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });
  afterAll(() => server.close());

  const get = (host: string, visitor: string, path = '/'): Promise<{ status: number; retryAfter?: string }> => new Promise((resolve, reject) => {
    const port = (server.address() as { port: number }).port;
    http.get({ host: '127.0.0.1', port, path, headers: { host, 'x-test-visitor': visitor } }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0, retryAfter: res.headers['retry-after'] as string | undefined }));
    }).on('error', reject);
  });

  it('answers 429 with a wait once a visitor is past the limit, and leaves other visitors alone', async () => {
    expect((await get('shop.test', '203.0.113.7')).status).toBe(200);
    expect((await get('shop.test', '203.0.113.7')).status).toBe(200);
    const third = await get('shop.test', '203.0.113.7');
    expect(third.status).toBe(429);
    expect(Number(third.retryAfter)).toBeGreaterThan(0);
    expect((await get('shop.test', '203.0.113.9')).status).toBe(200);
  });

  it('leaves a host the routing map does not know to the gateway', async () => {
    for (let i = 0; i < 5; i += 1) expect((await get('unknown.test', '203.0.113.50')).status).toBe(200);
  });

  it('refuses an attack with 403 before anything else, without spending the visitor\'s budget', async () => {
    expect((await get('shop.test', '203.0.113.30', '/.env')).status).toBe(403);
    expect((await get('shop.test', '203.0.113.30', '/x?id=1%20union%20select%201')).status).toBe(403);
    expect((await get('shop.test', '203.0.113.30', '/')).status).toBe(200);
  });
});

/** A scanner: refused for what it asks for until its address is stopped on every site. */
describe('GatewayEdgeCheck — stopping a scanner', () => {
  const map = TenantRouteMap.fromJson({
    routes: [{ host: 'shop.test', target: 'frontend', tenantId: 'shop' }, { host: 'blog.test', target: 'frontend', tenantId: 'blog' }],
    protection: new EdgeProtection([], 0, [], '', '', 0, true, ['/.env', '/.git/'], [], [], 3, 60).toJSON(),
  });
  const check = new GatewayEdgeCheck(async () => map, (req) => String(req.headers.host || ''));
  let server: http.Server;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      Object.defineProperty(req.socket, 'remoteAddress', { value: String(req.headers['x-test-visitor']), configurable: true });
      void check.handle(req, res).then((answered) => { if (!answered) res.end('through'); });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });
  afterAll(() => server.close());

  const get = (host: string, visitor: string, path = '/', extra: Record<string, string> = {}): Promise<{ status: number; body: string }> => new Promise((resolve, reject) => {
    const port = (server.address() as { port: number }).port;
    http.get({ host: '127.0.0.1', port, path, headers: { host, 'x-test-visitor': visitor, ...extra } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    }).on('error', reject);
  });

  it('stops the address on every site after the configured number of probes', async () => {
    expect((await get('shop.test', '198.51.100.4', '/.env')).status).toBe(403);
    expect((await get('shop.test', '198.51.100.4', '/')).status).toBe(200);
    expect((await get('shop.test', '198.51.100.4', '/.git/HEAD')).status).toBe(403);
    expect((await get('shop.test', '198.51.100.4', '/.env.local')).status).toBe(403);
    const home = await get('blog.test', '198.51.100.4', '/');
    expect(home.status).toBe(403);
    expect(home.body).toContain(GatewayEdgeCheck.SCANNER);
  });

  it('never stops a visitor for pages that simply pass, nor anyone else', async () => {
    for (let i = 0; i < 10; i += 1) expect((await get('shop.test', '198.51.100.5', `/missing-${i}`)).status).toBe(200);
    expect((await get('shop.test', '198.51.100.6', '/')).status).toBe(200);
  });

  it('never stops a visitor whose browser was made to fetch a probe by another site', async () => {
    for (const site of ['cross-site', 'same-site']) {
      for (let i = 0; i < 5; i += 1) expect((await get('shop.test', '198.51.100.7', '/.env', { 'sec-fetch-site': site })).status).toBe(403);
    }
    expect((await get('shop.test', '198.51.100.7', '/')).status).toBe(200);
  });

  it('never stops the platform\'s own servers', async () => {
    for (let i = 0; i < 5; i += 1) expect((await get('shop.test', '10.0.0.8', '/.env')).status).toBe(403);
    expect((await get('shop.test', '10.0.0.8', '/')).status).toBe(200);
  });
});

/** What the console is told: the stop with what it asked for, then how much was refused after it. */
describe('GatewayEdgeCheck — reporting a stop', () => {
  class Recorder extends GatewayEdgeReporter {
    readonly stops: Array<{ stop: unknown; reason: string }> = [];
    readonly refusedFromList: string[] = [];
    override stopped(stop: { address: string; until: string; strikes: number; hosts: string[]; paths: string[] }, reason: string): void { this.stops.push({ stop, reason }); }
    override refusedFrom(address: string): void { this.refusedFromList.push(address); }
  }
  const map = TenantRouteMap.fromJson({
    routes: [{ host: 'shop.test', target: 'frontend', tenantId: 'shop' }],
    protection: new EdgeProtection([], 0, [], '', '', 0, true, ['/.env'], [], [], 2, 60).toJSON(),
    stops: [{ address: '198.51.100.40', until: new Date(Date.now() + 3_600_000).toISOString() }],
  });
  const reporter = new Recorder();
  const check = new GatewayEdgeCheck(async () => map, (req) => String(req.headers.host || ''), new GatewayChallenge(), new GatewayRateLimit(), new GatewayVisitorRules(), new GatewayRefusalLog(), new GatewayScannerBan(), reporter);
  let server: http.Server;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      Object.defineProperty(req.socket, 'remoteAddress', { value: String(req.headers['x-test-visitor']), configurable: true });
      void check.handle(req, res).then((answered) => { if (!answered) res.end('through'); });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });
  afterAll(() => server.close());

  const get = (visitor: string, path = '/'): Promise<number> => new Promise((resolve, reject) => {
    const port = (server.address() as { port: number }).port;
    http.get({ host: '127.0.0.1', port, path, headers: { host: 'shop.test', 'x-test-visitor': visitor } }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode ?? 0));
    }).on('error', reject);
  });

  it('reports the stop once, with the site and what it asked for, and counts what is refused after it', async () => {
    expect(await get('198.51.100.41', '/.env')).toBe(403);
    expect(await get('198.51.100.41', '/.env?x=1')).toBe(403);
    expect(reporter.stops).toHaveLength(1);
    expect(reporter.stops[0].reason).toBe(GatewayEdgeCheck.SCANNER);
    expect(reporter.stops[0].stop).toMatchObject({ address: '198.51.100.41', strikes: 2, hosts: ['shop.test'], paths: ['/.env'] });
    expect(await get('198.51.100.41', '/')).toBe(403);
    expect(reporter.refusedFromList).toEqual(['198.51.100.41']);
  });

  it('refuses an address the routing map carries as stopped — a stop made before a restart', async () => {
    expect(await get('198.51.100.40', '/')).toBe(403);
    expect(await get('198.51.100.42', '/')).toBe(200);
  });
});
