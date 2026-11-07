import { describe, expect, it } from 'vitest';
import { GatewayTarget } from '@core/tenant/gateway-target';
import { HostPermission } from '@core/tenant/host-permission';
import { HostPermissionVerdict } from '@core/enums/host-permission-verdict.enum';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';

/** Settings → General → Domain aliases: more names for a single-site install's storefront. */
describe('TenantRouteMap — domain aliases of a single-site install', () => {
  const platform = { admin: 'https://shop.example/admin', api: 'https://shop.example', frontend: 'https://shop.example', aliases: ['www.shop.example', 'old.shop.example'] };

  it('routes each alias to the storefront, with the console path', () => {
    const route = TenantRouteMap.build([], platform).resolve('www.shop.example');
    expect(route?.target).toBe(GatewayTarget.FRONTEND);
    expect(route?.consolePath).toBe('/admin');
  });

  it('gives an alias a certificate', () => {
    expect(HostPermission.decide('old.shop.example', [], platform)).toBe(HostPermissionVerdict.PERMITTED);
    expect(HostPermission.decide('other.example', [], platform)).toBe(HostPermissionVerdict.UNKNOWN);
  });

  it('never routes platform aliases once sites exist — each site declares its own', () => {
    const site = TenantRecord.from({ id: 's', slug: 's', primary_host: 'site.example', state: 'active', visibility: 'public', kind: 'site' });
    expect(TenantRouteMap.build([site], platform).resolve('www.shop.example')).toBeUndefined();
  });

  it('never lets an alias take a platform host', () => {
    const map = TenantRouteMap.build([], { admin: 'https://admin.example', frontend: 'https://shop.example', aliases: ['admin.example'] });
    expect(map.resolve('admin.example')?.target).toBe(GatewayTarget.ADMIN);
  });
});
