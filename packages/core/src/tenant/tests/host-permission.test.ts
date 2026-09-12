import { describe, expect, it } from 'vitest';
import { HostPermission } from '@core/tenant/host-permission';
import { HostPermissionVerdict } from '@core/enums/host-permission-verdict.enum';
import { TenantRecord } from '@core/tenant/tenant-record';

/**
 * What the platform will vouch for — the question an edge asks before it spends a CERTIFICATE.
 *
 * Every "no" here is a certificate not issued, so the refusals matter more than the acceptance: a
 * suffix match would turn one tenant row into an unlimited certificate budget, and a yes for a host
 * nobody configured is a name this platform has no business claiming.
 */
describe('HostPermission — may an edge issue a certificate for this host', () => {
  const tenant = (overrides: Record<string, unknown> = {}): TenantRecord => TenantRecord.from({
    id: 'acme', slug: 'acme', primary_host: 'acme.test', host_aliases: '["shop.acme.test"]',
    state: 'active', kind: 'site', visibility: 'public', appearance: '', ...overrides,
  });

  const platform = { admin: 'https://admin.example.com', api: 'https://api.example.com', frontend: 'https://www.example.com' };
  const decide = (host: unknown, tenants = [tenant()]): HostPermissionVerdict =>
    HostPermission.decide(host, tenants, platform);

  it('permits a tenant primary host', () => {
    expect(decide('acme.test')).toBe(HostPermissionVerdict.PERMITTED);
  });

  it('permits a tenant alias', () => {
    expect(decide('shop.acme.test')).toBe(HostPermissionVerdict.PERMITTED);
  });

  it('permits the platform\'s own hosts, which belong to no tenant', () => {
    for (const host of ['admin.example.com', 'api.example.com', 'www.example.com']) {
      expect(decide(host), host).toBe(HostPermissionVerdict.PERMITTED);
    }
  });

  it('permits a PRIVATE site — it serves a holding page and its admins sign in over HTTPS', () => {
    expect(decide('acme.test', [tenant({ visibility: 'private' })])).toBe(HostPermissionVerdict.PERMITTED);
  });

  it('REFUSES a suspended site: the platform does not buy a certificate for a site that is off', () => {
    expect(decide('acme.test', [tenant({ state: 'suspended' })])).toBe(HostPermissionVerdict.SUSPENDED);
  });

  it('refuses a host nobody configured', () => {
    expect(decide('not-ours.example.org')).toBe(HostPermissionVerdict.UNKNOWN);
  });

  it('NEVER matches by suffix — one row must not authorise a whole domain', () => {
    for (const host of ['evil.acme.test', 'acme.test.evil.com', 'xacme.test']) {
      expect(decide(host), host).toBe(HostPermissionVerdict.UNKNOWN);
    }
  });

  it('refuses anything that is not a bare hostname', () => {
    for (const host of ['acme.test:443', 'https://acme.test', 'acme.test/path', 'acme test', '', null, undefined, 42]) {
      expect(decide(host), String(host)).toBe(HostPermissionVerdict.UNKNOWN);
    }
  });

  it('refuses IP addresses and loopback names', () => {
    for (const host of ['127.0.0.1', '10.0.0.5', 'localhost']) {
      expect(decide(host), host).toBe(HostPermissionVerdict.UNKNOWN);
    }
  });

  it('treats case and a trailing dot as the same name, so neither becomes a second entry', () => {
    expect(decide('ACME.test')).toBe(HostPermissionVerdict.PERMITTED);
    expect(decide('acme.test.')).toBe(HostPermissionVerdict.PERMITTED);
  });

  it('carries the status the endpoint answers with', () => {
    expect(HostPermissionVerdict.PERMITTED.status).toBe(200);
    expect(HostPermissionVerdict.UNKNOWN.status).toBe(404);
    expect(HostPermissionVerdict.SUSPENDED.status).toBe(403);
  });
});
