import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'http';
import { EdgeProtection, EdgeSiteRules, TenantRouteMap } from '@fromcode119/core';
import { GatewayVisitorRules } from '@cli/services/gateway/challenge/gateway-visitor-rules';
import { GatewayEdgeCheck } from '@cli/services/gateway/challenge/gateway-edge-check';
import { GatewayChallenge } from '@cli/services/gateway/challenge/gateway-challenge';
import { GatewayRateLimit } from '@cli/services/gateway/challenge/gateway-rate-limit';

/** A geo database that knows a few test addresses. */
class GeoFixture {
  static readonly COUNTRIES: Record<string, string> = { '203.0.113.1': 'KP', '203.0.113.2': 'BR', '203.0.113.3': 'BG' };
  static lookup(address: unknown) {
    const code = GeoFixture.COUNTRIES[String(address)];
    return code ? { countryCode: code, country: '', region: '', city: '' } : null;
  }
}

class VisitorFixture {
  static request(address: string): http.IncomingMessage {
    return { socket: { remoteAddress: address }, headers: {}, url: '/' } as unknown as http.IncomingMessage;
  }
}

describe('GatewayVisitorRules', () => {
  const rules = new GatewayVisitorRules(GeoFixture);
  const site = new EdgeSiteRules(null, ['KP'], ['BR'], ['198.51.100.0/24', '2001:db8::/32']);

  it('refuses blocked addresses and countries, checks the always-checked countries, passes the rest', () => {
    expect(rules.verdict(VisitorFixture.request('198.51.100.77'), site)).toEqual({ action: 'refuse', reason: 'blocked_address' });
    expect(rules.verdict(VisitorFixture.request('2001:db8::5'), site)).toEqual({ action: 'refuse', reason: 'blocked_address' });
    expect(rules.verdict(VisitorFixture.request('203.0.113.1'), site)).toEqual({ action: 'refuse', reason: 'blocked_country' });
    expect(rules.verdict(VisitorFixture.request('203.0.113.2'), site)).toEqual({ action: 'check' });
    expect(rules.verdict(VisitorFixture.request('203.0.113.3'), site)).toEqual({ action: 'pass' });
  });

  it('never refuses an address the geo database cannot place, nor the platform\'s own servers', () => {
    expect(rules.verdict(VisitorFixture.request('203.0.113.200'), site)).toEqual({ action: 'pass' });
    expect(rules.verdict(VisitorFixture.request('172.18.0.4'), new EdgeSiteRules(null, [], [], ['172.16.0.0/12']))).toEqual({ action: 'pass' });
  });

  it('a site\'s own rules win over the platform\'s; a site without its own follows the platform', () => {
    const protection = new EdgeProtection([], 0, [], '', '', 0, false, [], [], [
      new EdgeSiteRules(null, ['KP'], [], []),
      new EdgeSiteRules('shop', [], [], []),
    ]);
    expect(rules.verdict(VisitorFixture.request('203.0.113.1'), protection.rulesFor('shop'))).toEqual({ action: 'pass' });
    expect(rules.verdict(VisitorFixture.request('203.0.113.1'), protection.rulesFor('blog'))).toEqual({ action: 'refuse', reason: 'blocked_country' });
  });
});

describe('GatewayEdgeCheck — country and address rules', () => {
  const map = TenantRouteMap.fromJson({
    routes: [{ host: 'shop.test', target: 'frontend', tenantId: 'shop' }],
    protection: new EdgeProtection([], 0, ['/api/'], 'Checking your browser', 'One moment', 0, false, [], [], [new EdgeSiteRules(null, ['KP'], ['BR'], [])]).toJSON(),
  });
  const check = new GatewayEdgeCheck(async () => map, (req) => String(req.headers.host || ''), new GatewayChallenge(), new GatewayRateLimit(), new GatewayVisitorRules(GeoFixture));
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
    http.get({ host: '127.0.0.1', port, path, headers: { host: 'shop.test', 'x-test-visitor': visitor } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode ?? 0)); }).on('error', reject);
  });

  it('refuses a blocked country, checks an always-checked one though the site is not under attack, passes others', async () => {
    expect(await get('203.0.113.1')).toBe(403);
    expect(await get('203.0.113.2')).toBe(503);
    expect(await get('203.0.113.2', '/api/health')).toBe(200);
    expect(await get('203.0.113.3')).toBe(200);
  });
});
