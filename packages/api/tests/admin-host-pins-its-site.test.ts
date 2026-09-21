import { describe, expect, it } from 'vitest';
import { TenantRecord } from '@fromcode119/core';
import { WorkspaceHostService } from '@api/services/request/workspace-host-service';

/**
 * A console host must pin the site it names.
 *
 * On a host that serves the admin, the HOST decides which tenant the request is for — the session's
 * claim gets no say and membership is still checked on every request. That rule used to ask
 * `tenant.isWorkspace`, which was right while only a workspace could have its own console.
 *
 * Now a site can declare one of its hosts as its admin. Without this, such a host would open the
 * console and manage whatever the operator's session happened to have selected — another site's data
 * under a URL naming this one. Not a data leak (membership and row-level security still hold), but a
 * site's own console showing a different site is wrong in the way that erodes trust in the screen.
 */
const tenant = (over: Record<string, unknown>) => TenantRecord.from({
  id: 'shop', slug: 'shop', primary_host: 'shop.example.com', host_aliases: '[]',
  state: 'active', visibility: 'public', kind: 'site', ...over,
});

const resolverFor = (record: TenantRecord | null) => ({
  resolveByHost: async (host: string) => (record && record.hosts().includes(host) ? record : null),
});

const service = (record: TenantRecord | null) =>
  new WorkspaceHostService(resolverFor(record) as never);

const request = (host: string) => ({ headers: { host }, get: (name: string) => (name.toLowerCase() === 'host' ? host : undefined) });

describe('WorkspaceHostService — an admin host names its own tenant', () => {
  it('pins a SITE whose host declares the admin role', async () => {
    const site = tenant({
      host_aliases: '["backend.shop.example.com"]',
      host_roles: '{"backend.shop.example.com":"admin"}',
    });

    const found = await service(site).resolve(request('backend.shop.example.com'));
    expect(found?.id).toBe('shop');
  });

  it('still pins a WORKSPACE with no configuration at all', async () => {
    // `roleFor` falls back to the tenant's kind, and a workspace's default IS admin.
    const workspace = tenant({ kind: 'workspace' });

    const found = await service(workspace).resolve(request('shop.example.com'));
    expect(found?.id).toBe('shop');
  });

  it('does NOT pin a storefront host — that request falls back to the session', async () => {
    const site = tenant({ host_aliases: '["www.shop.example.com"]' });

    expect(await service(site).resolve(request('shop.example.com'))).toBeNull();
    expect(await service(site).resolve(request('www.shop.example.com'))).toBeNull();
  });

  /** A site host declared as the API is not a console either. */
  it('does NOT pin a host declared as the api', async () => {
    const site = tenant({
      host_aliases: '["api.shop.example.com"]',
      host_roles: '{"api.shop.example.com":"api"}',
    });

    expect(await service(site).resolve(request('api.shop.example.com'))).toBeNull();
  });

  /** A workspace host explicitly declared a storefront stops being a console. */
  it('honours a declared role that overrides the tenant default', async () => {
    const workspace = tenant({ kind: 'workspace', host_roles: '{"shop.example.com":"storefront"}' });

    expect(await service(workspace).resolve(request('shop.example.com'))).toBeNull();
  });

  it('resolves to nothing for a host no tenant claims', async () => {
    expect(await service(tenant({ kind: 'workspace' })).resolve(request('nobody.example.com'))).toBeNull();
  });
});
