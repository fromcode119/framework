import { describe, expect, it } from 'vitest';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantRoute } from '@core/tenant/tenant-route';
import { GatewayTarget } from '@core/tenant/gateway-target';

/** A site's console path: where its own storefront hosts also serve its console. */
describe('TenantIdentity.consolePathFor', () => {
  it('normalises what the operator typed', () => {
    expect(TenantIdentity.consolePathFor('admin')).toBe('/admin');
    expect(TenantIdentity.consolePathFor(' /Backend/ ')).toBe('/backend');
    expect(TenantIdentity.consolePathFor('/team/console')).toBe('/team/console');
    expect(TenantIdentity.consolePathFor('')).toBe('');
    expect(TenantIdentity.consolePathFor(undefined)).toBe('');
  });

  it('refuses paths the host already serves or that are not plain segments', () => {
    for (const bad of ['/api', '/api/x', '/uploads', '/plugins', '/themes', '/_next', '/_fc-console', '/a b', '/a//b', '/a?b', '/ü']) {
      expect(() => TenantIdentity.consolePathFor(bad), bad).toThrow();
    }
  });

  it('is refused on a workspace, whose hosts are already its console', () => {
    const base = { id: 'w', slug: 'w', primaryHost: 'w.example.com' };
    expect(() => TenantIdentity.from({ ...base, kind: 'workspace', consolePath: '/admin' })).toThrow(/workspace/);
    expect(TenantIdentity.from({ ...base, kind: 'site', consolePath: '/admin' }).consolePath).toBe('/admin');
  });

  it('is read back from the row', () => {
    const record = TenantRecord.from({ id: 's', slug: 's', primary_host: 's.example.com', host_aliases: '[]', state: 'active', kind: 'site', console_path: '/admin' });
    expect(record.consolePath).toBe('/admin');
  });
});

describe('TenantRoute.consoleRequestPath', () => {
  const route = new TenantRoute('s.example.com', GatewayTarget.FRONTEND, 's', '/admin');
  it('strips the mount and keeps the query', () => {
    expect(route.consoleRequestPath('/admin')).toBe('/');
    expect(route.consoleRequestPath('/admin/')).toBe('/');
    expect(route.consoleRequestPath('/admin/users?page=2')).toBe('/users?page=2');
    expect(route.consoleRequestPath('/admin?next=%2F')).toBe('/?next=%2F');
  });
  it('answers null for everything else', () => {
    expect(route.consoleRequestPath('/administration')).toBeNull();
    expect(route.consoleRequestPath('/')).toBeNull();
    expect(new TenantRoute('s.example.com', GatewayTarget.FRONTEND, 's').consoleRequestPath('/admin')).toBeNull();
  });
  it('survives the route map round trip', () => {
    expect(TenantRoute.from(route.toJSON()).consolePath).toBe('/admin');
  });
});
