import { describe, expect, it } from 'vitest';
import { TenantRecord, TenantRouteMap } from '@fromcode119/core';
import { PlatformGateway } from '../src/services/platform-gateway';

const targets = { api: 'http://api:3000', admin: 'http://admin:3000', frontend: 'http://frontend:3000' };
const site = TenantRecord.from({ id: 'acme', slug: 'acme', primary_host: 'acme.test', host_aliases: '["api.acme.test"]', state: 'active', kind: 'site' });
const workspace = TenantRecord.from({ id: 'nexora', slug: 'nexora', primary_host: 'nexora.test', host_aliases: '[]', state: 'active', kind: 'workspace', appearance: 'nexora' });
const map = TenantRouteMap.build([site, workspace], { admin: 'admin.platform.test', api: 'api.platform.test', frontend: 'frontend.platform.test' });

describe('PlatformGateway.resolveTarget', () => {
  it('routes by host from the tenant table: site → frontend, workspace → admin, api. alias → api', () => {
    expect(PlatformGateway.resolveTarget(map, 'acme.test', '/', targets)).toBe(targets.frontend);
    expect(PlatformGateway.resolveTarget(map, 'nexora.test', '/mlm/affiliates', targets)).toBe(targets.admin);
    expect(PlatformGateway.resolveTarget(map, 'api.acme.test', '/api/v1/plugins/tagiqx/gw', targets)).toBe(targets.api);
    expect(PlatformGateway.resolveTarget(map, 'admin.platform.test', '/', targets)).toBe(targets.admin);
  });

  it('a workspace console reaches the api on its own origin: /api and asset paths on an admin host go to the api', () => {
    expect(PlatformGateway.resolveTarget(map, 'nexora.test', '/api/v1/auth/host', targets)).toBe(targets.api);
    expect(PlatformGateway.resolveTarget(map, 'nexora.test', '/plugins/mlm/ui/bundle.js', targets)).toBe(targets.api);
    expect(PlatformGateway.resolveTarget(map, 'acme.test', '/api/v1/system/frontend', targets)).toBe(targets.frontend);
    expect(PlatformGateway.resolveTarget(map, 'nexora.test', '/uploads/2026/09/logo.png', targets)).toBe(targets.api);
  });

  it('the admin keeps its own pages on an admin host: /media and /plugins/<slug>/settings are not api paths', () => {
    for (const host of ['admin.platform.test', 'nexora.test']) {
      expect(PlatformGateway.resolveTarget(map, host, '/media', targets)).toBe(targets.admin);
      expect(PlatformGateway.resolveTarget(map, host, '/plugins/tagiqx/settings', targets)).toBe(targets.admin);
      expect(PlatformGateway.resolveTarget(map, host, '/plugins/installed', targets)).toBe(targets.admin);
      expect(PlatformGateway.resolveTarget(map, host, '/themes', targets)).toBe(targets.admin);
      expect(PlatformGateway.resolveTarget(map, host, '/plugins/cms/ui/bundle.js', targets)).toBe(targets.api);
      expect(PlatformGateway.resolveTarget(map, host, '/api/v1/system/admin/metadata', targets)).toBe(targets.api);
    }
  });

  it('answers a host nobody owns with nothing — fail-closed, like the api', () => {
    expect(PlatformGateway.resolveTarget(map, 'stranger.test', '/', targets)).toBeNull();
  });

  it('without a routing map it is the single-domain gateway it always was: path rules', () => {
    expect(PlatformGateway.resolveTarget(null, 'platform.test', '/api/v1/health', targets)).toBe(targets.api);
    expect(PlatformGateway.resolveTarget(null, 'platform.test', '/admin/sites', targets)).toBe(targets.admin);
    expect(PlatformGateway.resolveTarget(null, 'platform.test', '/shop', targets)).toBe(targets.frontend);
  });
});
