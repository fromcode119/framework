import { describe, expect, it } from 'vitest';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';
import { GatewayTarget } from '@core/tenant/gateway-target';

const site = TenantRecord.from({ id: 'acme', slug: 'acme', primary_host: 'acme.test', host_aliases: '["www.acme.test","api.acme.test"]', state: 'active', kind: 'site' });
const workspace = TenantRecord.from({ id: 'workspace-a', slug: 'workspace-a', primary_host: 'workspace-a.test', host_aliases: '["api.workspace-a.test"]', state: 'suspended', kind: 'workspace', appearance: 'workspace-a' });

describe('TenantRouteMap', () => {
  const map = TenantRouteMap.build([site, workspace], { admin: 'https://admin.platform.test', api: 'api.platform.test', frontend: 'http://frontend.platform.test:3000' });

  it('sends a site\'s hosts to the frontend and a workspace\'s hosts to the admin', () => {
    expect(map.resolve('acme.test')?.target).toBe(GatewayTarget.FRONTEND);
    expect(map.resolve('WWW.acme.test:443')?.target).toBe(GatewayTarget.FRONTEND);
    expect(map.resolve('workspace-a.test')?.target).toBe(GatewayTarget.ADMIN);
    expect(map.resolve('workspace-a.test')?.tenantId).toBe('workspace-a');
  });

  it('sends any api. alias to the api, whatever the kind', () => {
    expect(map.resolve('api.acme.test')?.target).toBe(GatewayTarget.API);
    expect(map.resolve('api.workspace-a.test')?.target).toBe(GatewayTarget.API);
  });

  it('knows the platform\'s own hosts from their public URLs', () => {
    expect(map.resolve('admin.platform.test')?.target).toBe(GatewayTarget.ADMIN);
    expect(map.resolve('api.platform.test')?.target).toBe(GatewayTarget.API);
    expect(map.resolve('frontend.platform.test')?.target).toBe(GatewayTarget.FRONTEND);
    expect(map.resolve('admin.platform.test')?.tenantId).toBeNull();
  });

  it('routes a suspended tenant (the app answers 503 with the reason) and nothing else', () => {
    expect(map.resolve('workspace-a.test')).toBeDefined();
    expect(map.resolve('nobody.test')).toBeUndefined();
  });

  it('round-trips through JSON, which is how the gateway receives it', () => {
    const copy = TenantRouteMap.fromJson(JSON.parse(JSON.stringify(map)));
    expect(copy.size).toBe(map.size);
    expect(copy.resolve('api.workspace-a.test')?.target).toBe(GatewayTarget.API);
  });
});
