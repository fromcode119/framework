import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'http';
import { EdgeProtection, TenantRouteMap } from '@fromcode119/core';
import { GatewayEdgeCheck } from '@cli/services/gateway/challenge/gateway-edge-check';

/** The gateway's edge check in front of a stub app, with a routing map that knows one site. */
describe('GatewayEdgeCheck — requests per visitor', () => {
  const map = TenantRouteMap.fromJson({
    routes: [{ host: 'shop.test', target: 'frontend', tenantId: 'shop' }],
    protection: new EdgeProtection([], 0, ['/api/'], '', '', 2).toJSON(),
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

  const get = (host: string, visitor: string): Promise<{ status: number; retryAfter?: string }> => new Promise((resolve, reject) => {
    const port = (server.address() as { port: number }).port;
    http.get({ host: '127.0.0.1', port, path: '/', headers: { host, 'x-test-visitor': visitor } }, (res) => {
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
});
