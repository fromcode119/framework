import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginTenantAccess, RequestContextUtils, TenantMode } from '@fromcode119/core';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';
import { TenantPluginGuard } from '@api/middlewares/tenant-plugin-guard';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';

/** `users` is read through the RAW manager, so the row carries snake_case — the fixture mirrors that. */
function dbWithPlatformAdmins(ids: string[]) {
  return {
    findOne: vi.fn(async (_table: string, where: any) => ({ id: where.id, is_platform_admin: ids.includes(String(where.id)) })),
    find: vi.fn(async () => []),
  } as any;
}

function response() {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

function multiTenant() {
  TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
}

afterEach(() => {
  TenantMode.reset();
  PluginTenantAccess.reset();
});

describe('PlatformAdminGuard', () => {
  it('passes every admin on a SINGLE-TENANT deployment — there, the admin IS the platform', async () => {
    const guard = new PlatformAdminGuard(new PlatformAccessResolver(dbWithPlatformAdmins([])));
    const next = vi.fn();
    await guard.handle({ user: { id: '7' } } as any, response() as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("REFUSES a tenant's own admin on a multi-tenant deployment", async () => {
    // This is the hole: `admin` alone let one customer install code onto the box every other customer
    // runs on. The role means "admin of my site", never "admin of the platform".
    multiTenant();
    const guard = new PlatformAdminGuard(new PlatformAccessResolver(dbWithPlatformAdmins(['1'])));
    const res = response(); const next = vi.fn();
    await guard.handle({ user: { id: '7', roles: ['admin'] } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('platform_admin_required');
  });

  it('passes a platform admin on a multi-tenant deployment', async () => {
    multiTenant();
    const guard = new PlatformAdminGuard(new PlatformAccessResolver(dbWithPlatformAdmins(['1'])));
    const next = vi.fn();
    await guard.handle({ user: { id: '1' } } as any, response() as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('refuses a request with no user rather than looking anyone up', async () => {
    multiTenant();
    const db = dbWithPlatformAdmins(['1']);
    const guard = new PlatformAdminGuard(new PlatformAccessResolver(db));
    const res = response();
    await guard.handle({} as any, res as any, vi.fn());
    expect(res.statusCode).toBe(403);
    expect(db.findOne).not.toHaveBeenCalled();
  });
});

describe('PlatformAccessResolver', () => {
  it('reads the account ONCE per request, however many guards and controllers ask', async () => {
    multiTenant();
    const db = dbWithPlatformAdmins(['1']);
    const resolver = new PlatformAccessResolver(db);
    const req = { user: { id: '1' } } as any;
    expect(await resolver.isPlatformAdmin(req)).toBe(true);
    expect(await resolver.isPlatformAdmin(req)).toBe(true);
    expect(await resolver.isPlatformAdmin(req)).toBe(true);
    expect(db.findOne).toHaveBeenCalledTimes(1);
  });

  it('does not let one request\'s answer leak into another', async () => {
    multiTenant();
    const resolver = new PlatformAccessResolver(dbWithPlatformAdmins(['1']));
    expect(await resolver.isPlatformAdmin({ user: { id: '1' } } as any)).toBe(true);
    expect(await resolver.isPlatformAdmin({ user: { id: '7' } } as any)).toBe(false);
  });
});

describe('TenantPluginGuard', () => {
  it('passes everything on a single-tenant deployment', async () => {
    const guard = new TenantPluginGuard(new PlatformAccessResolver(dbWithPlatformAdmins([])));
    const next = vi.fn();
    await guard.handle({ params: { slug: 'eta' }, user: { id: '7' } } as any, response() as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('lets a tenant admin reach the settings of a plugin its site RUNS', async () => {
    multiTenant();
    PluginTenantAccess.configure({ find: vi.fn(async () => [{ plugin_slug: 'eta', state: 'active' }]) } as any);
    await PluginTenantAccess.warm('t1');
    const guard = new TenantPluginGuard(new PlatformAccessResolver(dbWithPlatformAdmins([])));
    const next = vi.fn();
    await RequestContextUtils.storage.run({ tenantId: 't1' } as any, () =>
      guard.handle({ params: { slug: 'eta' }, user: { id: '7' } } as any, response() as any, next));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("refuses a tenant admin the settings of a plugin its site does NOT run — the catalogue's side door", async () => {
    multiTenant();
    PluginTenantAccess.configure({ find: vi.fn(async () => [{ plugin_slug: 'eta', state: 'active' }]) } as any);
    await PluginTenantAccess.warm('t1');
    const guard = new TenantPluginGuard(new PlatformAccessResolver(dbWithPlatformAdmins([])));
    const res = response(); const next = vi.fn();
    await RequestContextUtils.storage.run({ tenantId: 't1' } as any, () =>
      guard.handle({ params: { slug: 'gamma' }, user: { id: '7' } } as any, res as any, next));
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('plugin_not_enabled_for_tenant');
  });

  it('lets a PLATFORM admin reach any slug — it configures a plugin before switching it on for a site', async () => {
    multiTenant();
    PluginTenantAccess.configure({ find: vi.fn(async () => []) } as any);
    await PluginTenantAccess.warm('t1');
    const guard = new TenantPluginGuard(new PlatformAccessResolver(dbWithPlatformAdmins(['1'])));
    const next = vi.fn();
    await RequestContextUtils.storage.run({ tenantId: 't1' } as any, () =>
      guard.handle({ params: { slug: 'gamma' }, user: { id: '1' } } as any, response() as any, next));
    expect(next).toHaveBeenCalledTimes(1);
  });
});
