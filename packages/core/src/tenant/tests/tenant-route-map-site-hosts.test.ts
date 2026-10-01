import { describe, expect, it } from 'vitest';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';

describe('TenantRouteMap.siteHosts', () => {
  it('lists one frontend host per site, from the wire format the gateway reads', () => {
    const map = TenantRouteMap.fromJson({ routes: [
      { host: 'shop.example', target: 'frontend', tenantId: 'shop' },
      { host: 'www.shop.example', target: 'frontend', tenantId: 'shop' },
      { host: 'console.example', target: 'admin', tenantId: 'workspace' },
      { host: 'platform.example', target: 'frontend', tenantId: null },
    ] });
    expect(map.siteHosts()).toEqual(['shop.example']);
  });
});
