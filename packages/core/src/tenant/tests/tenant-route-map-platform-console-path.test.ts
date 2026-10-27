import { describe, expect, it } from 'vitest';
import { GatewayTarget } from '@core/tenant/gateway-target';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';

describe('TenantRouteMap — the platform console on a path of the frontend host', () => {
  it('keeps the host on the frontend and mounts the console at the admin path', () => {
    const map = TenantRouteMap.build([], { admin: 'https://shop.example/admin/', frontend: 'https://shop.example' });
    const route = map.resolve('shop.example');
    expect(route?.target).toBe(GatewayTarget.FRONTEND);
    expect(route?.consolePath).toBe('/admin');
    expect(route?.consoleRequestPath('/admin/settings')).toBe('/settings');
  });

  it('routes a console on its own host to the admin, unmounted', () => {
    const map = TenantRouteMap.build([], { admin: 'https://admin.example', frontend: 'https://shop.example' });
    expect(map.resolve('admin.example')?.target).toBe(GatewayTarget.ADMIN);
    expect(map.resolve('shop.example')?.consolePath).toBe('');
  });

  it('survives the wire format the gateway reads', () => {
    const built = TenantRouteMap.build([], { admin: 'https://shop.example/admin', frontend: 'https://shop.example' });
    const read = TenantRouteMap.fromJson(JSON.parse(JSON.stringify(built.toJSON())));
    expect(read.resolve('shop.example')?.consolePath).toBe('/admin');
  });

  it("never mounts the platform console on a site's own host", () => {
    const site = TenantRecord.from({ id: 'other', slug: 'other', primary_host: 'shop.example', state: 'active', visibility: 'public', kind: 'site' });
    const route = TenantRouteMap.build([site], { admin: 'https://shop.example/admin', frontend: 'https://shop.example' }).resolve('shop.example');
    expect(route?.tenantId).toBe('other');
    expect(route?.consolePath).toBe('');
  });
});
