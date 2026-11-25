import { describe, expect, it } from 'vitest';
import { EdgeControlEndpoint } from '@core/security/edge/identity/edge-control-endpoint';
import { EdgeProtection } from '@core/security/edge/edge-protection';
import { EdgeRuleSnapshot } from '@core/security/edge/edge-rule-snapshot';
import { EdgeSiteRules } from '@core/security/edge/edge-site-rules';
import { EdgeStop } from '@core/security/edge/edge-stop';
import { GatewayTarget } from '@core/tenant/gateway-target';
import { TenantRoute } from '@core/tenant/tenant-route';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';

describe('EdgeRuleSnapshot', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  const protection = (rules: EdgeSiteRules[]) => new EdgeProtection([], 0, [], '', '', 0, false, [], [], rules);
  const routes = [new TenantRoute('a.test', GatewayTarget.FRONTEND, 't1'), new TenantRoute('b.test', GatewayTarget.FRONTEND, 't2')];

  it('takes only what holds on every site: stops, and addresses every site blocks', () => {
    const map = new TenantRouteMap(routes).withProtection(protection([
      new EdgeSiteRules(null, [], [], ['192.0.2.0/24', '198.51.100.9']),
      new EdgeSiteRules('t2', [], [], ['192.0.2.0/24']),
    ])).withStops([new EdgeStop('203.0.113.5', now + 60_000), new EdgeStop('203.0.113.6', now - 1)]);
    const snapshot = EdgeRuleSnapshot.fromMap(map, now);
    expect(snapshot.blocked).toEqual(['192.0.2.0/24']);
    expect(snapshot.stops.map((stop) => stop.address)).toEqual(['203.0.113.5']);
    expect(snapshot.refuses('192.0.2.77', now)).toBe(true);
    expect(snapshot.refuses('198.51.100.9', now)).toBe(false); // site t2 does not block it
    expect(snapshot.refuses('203.0.113.5', now + 60_001)).toBe(false); // the edge ends a stop on time itself
  });

  it('refuses any address of a stopped IPv6 /64 and nothing outside it', () => {
    const snapshot = EdgeRuleSnapshot.of([new EdgeStop('2a01:4f8:1c19:96de::/64', now + 60_000)], [], now);
    expect(snapshot.refuses('2a01:4f8:1c19:96de::1', now)).toBe(true);
    expect(snapshot.refuses('2a01:4f8:1c19:96de:1:2:3:4', now)).toBe(true);
    expect(snapshot.refuses('2a01:4f8:1c19:96df::1', now)).toBe(false);
    expect(snapshot.refuses('203.0.113.5', now)).toBe(false);
    expect(snapshot.refuses('::1', now)).toBe(false);
    expect(EdgeRuleSnapshot.fromJson(JSON.parse(JSON.stringify(snapshot)))?.refuses('2a01:4f8:1c19:96de::9', now)).toBe(true);
  });

  it('names its content: the same rules give the same version, and it survives a trip to disk', () => {
    const one = EdgeRuleSnapshot.of([new EdgeStop('203.0.113.5', now + 60_000)], ['192.0.2.1'], now);
    const two = EdgeRuleSnapshot.of([new EdgeStop('203.0.113.5', now + 60_000)], ['192.0.2.1'], now + 5_000);
    expect(two.version).toBe(one.version);
    expect(EdgeRuleSnapshot.of([], ['192.0.2.1'], now).version).not.toBe(one.version);
    const back = EdgeRuleSnapshot.fromJson(JSON.parse(JSON.stringify(one)));
    expect(back?.version).toBe(one.version);
    expect(EdgeRuleSnapshot.fromJson({ version: 'forged' })).toBeNull();
  });
});

describe('EdgeControlEndpoint', () => {
  it('is set only by a valid address and port, and travels in the routing map', () => {
    expect(EdgeControlEndpoint.from('', '8443')).toBeNull();
    expect(EdgeControlEndpoint.from('control.example.test', '')).toBeNull();
    expect(EdgeControlEndpoint.from('control.example.test', '70000')).toBeNull();
    expect(EdgeControlEndpoint.from('bad host!', '8443')).toBeNull();
    expect(EdgeControlEndpoint.from('2001:db8::1', '8443')?.dial).toBe('[2001:db8::1]:8443');
    const control = EdgeControlEndpoint.from('Control.Example.Test', '8443')!;
    expect(control.isAddress).toBe(false);
    const map = TenantRouteMap.fromJson(JSON.parse(JSON.stringify(new TenantRouteMap([]).withControl(control))));
    expect(map.control?.dial).toBe('control.example.test:8443');
    expect(TenantRouteMap.fromJson({ routes: [] }).control).toBeNull();
  });
});
