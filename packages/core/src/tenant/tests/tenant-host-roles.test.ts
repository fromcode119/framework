import { describe, expect, it } from 'vitest';
import { GatewayTarget } from '@core/tenant/gateway-target';
import { TenantHostRole } from '@core/tenant/tenant-host-role';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';

/**
 * What a host answers with must be something somebody CHOSE.
 *
 * It used to be read out of the hostname: anything starting `api.` went to the api, everything else
 * followed the tenant's kind, and no screen said so. A shop alias called `api.shop.com` silently
 * stopped serving the shop; a site that wanted its own api host had to guess that one prefix was
 * magic. These tests pin the replacement — a declared role — and, just as importantly, pin that the
 * name is now meaningless.
 */
const tenant = (over: Record<string, unknown> = {}) => TenantRecord.from({
  id: 'shop',
  slug: 'shop',
  primary_host: 'shop.example.com',
  host_aliases: JSON.stringify(['api.shop.example.com', 'backend.shop.example.com']),
  state: 'active',
  visibility: 'public',
  kind: 'site',
  ...over,
});

const platform = { admin: 'https://console.example.com', api: 'https://api.example.com', frontend: 'https://www.example.com' };
const targetOf = (record: TenantRecord, host: string) =>
  TenantRouteMap.build([record], platform).resolve(host)?.target;

describe('Tenant host roles — declared, never read from the name', () => {
  it('an api.-prefixed host is a STOREFRONT unless somebody said otherwise', () => {
    const site = tenant();

    expect(site.roleFor('api.shop.example.com')).toBe(TenantHostRole.STOREFRONT);
    expect(targetOf(site, 'api.shop.example.com')).toBe(GatewayTarget.FRONTEND);
  });

  it('any name can be the console when it is declared', () => {
    const site = tenant({ host_roles: JSON.stringify({ 'backend.shop.example.com': 'admin' }) });

    expect(site.roleFor('backend.shop.example.com')).toBe(TenantHostRole.ADMIN);
    expect(targetOf(site, 'backend.shop.example.com')).toBe(GatewayTarget.ADMIN);
  });

  it('a declared api host goes to the api whatever it is called', () => {
    const site = tenant({ host_roles: JSON.stringify({ 'backend.shop.example.com': 'api' }) });

    expect(targetOf(site, 'backend.shop.example.com')).toBe(GatewayTarget.API);
    expect(site.apiHosts()).toEqual(['backend.shop.example.com']);
  });

  it('a host nobody declared takes the tenant default: a site serves its storefront', () => {
    expect(targetOf(tenant(), 'shop.example.com')).toBe(GatewayTarget.FRONTEND);
  });

  it('a host nobody declared takes the tenant default: a workspace serves its console', () => {
    const workspace = tenant({ kind: 'workspace', host_aliases: '[]' });

    expect(workspace.roleFor('shop.example.com')).toBe(TenantHostRole.ADMIN);
    expect(targetOf(workspace, 'shop.example.com')).toBe(GatewayTarget.ADMIN);
  });

  it('a declared role overrides the tenant default, both ways', () => {
    const workspace = tenant({ kind: 'workspace', host_roles: JSON.stringify({ 'shop.example.com': 'storefront' }) });

    expect(targetOf(workspace, 'shop.example.com')).toBe(GatewayTarget.FRONTEND);
  });

  it('matches a host regardless of case', () => {
    const site = tenant({ host_roles: JSON.stringify({ 'BACKEND.Shop.Example.COM': 'admin' }) });

    expect(site.roleFor('backend.shop.example.com')).toBe(TenantHostRole.ADMIN);
  });

  /** A role nobody recognises must not be kept — it would show as a setting that does nothing. */
  it('drops a role that names nothing, falling back to the default', () => {
    const site = tenant({ host_roles: JSON.stringify({ 'backend.shop.example.com': 'wizard' }) });

    expect(site.hostRoles['backend.shop.example.com']).toBeUndefined();
    expect(site.roleFor('backend.shop.example.com')).toBe(TenantHostRole.STOREFRONT);
  });

  it('survives a malformed roles value', () => {
    const site = tenant({ host_roles: 'not json at all' });

    expect(site.hostRoles).toEqual({});
    expect(site.roleFor('shop.example.com')).toBe(TenantHostRole.STOREFRONT);
  });

  it('the platform\'s own declared hosts are unaffected', () => {
    const map = TenantRouteMap.build([tenant()], platform);

    expect(map.resolve('console.example.com')?.target).toBe(GatewayTarget.ADMIN);
    expect(map.resolve('api.example.com')?.target).toBe(GatewayTarget.API);
    expect(map.resolve('www.example.com')?.target).toBe(GatewayTarget.FRONTEND);
  });

  it('apiHosts reports only what was declared, not what is named api', () => {
    expect(tenant().apiHosts()).toEqual([]);
  });
});
