import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { TenantMode } from '@fromcode119/core';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';
import { TenantAdminRouter } from '@api/routes/tenant-admin-router';

/**
 * The router's whole security story: every route needs `admin` AND platform admin. The service
 * behind it is stubbed — what is under test is that a tenant's own administrator cannot reach the
 * registry at all, on any verb, and that a platform admin can.
 */
function app(userId: string, roles: string[], platformAdmins: string[]) {
  const auth: any = {
    guard: (required: string[] = []) => (req: any, res: any, next: any) => {
      req.user = { id: userId, roles };
      if (required.length && !required.some((role) => roles.includes(role))) return res.status(403).json({ error: 'forbidden' });
      next();
    },
  };
  const db: any = {
    findOne: vi.fn(async (_table: string, where: any) => ({ id: where.id, is_platform_admin: platformAdmins.includes(String(where.id)) })),
    find: vi.fn(async () => []),
    count: vi.fn(async () => 0),
  };
  const manager: any = { db, schemaDb: db, registeredCollections: new Map(), getPlugins: () => [] };
  const themeManager: any = { getThemes: () => [] };
  const router = new TenantAdminRouter(manager, themeManager, '/tmp/uploads-under-test', auth, new PlatformAdminGuard(new PlatformAccessResolver(db)));
  const server = express();
  server.use(express.json());
  server.use('/tenants', router.router);
  return server;
}

afterEach(() => TenantMode.reset());

describe('TenantAdminRouter', () => {
  it("refuses a tenant's own admin on every verb — the registry is not its surface", async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const server = app('7', ['admin'], ['1']);
    for (const [method, url] of [['get', '/tenants/'], ['post', '/tenants/'], ['get', '/tenants/t1'], ['patch', '/tenants/t1'], ['delete', '/tenants/t1'], ['post', '/tenants/t1/export'], ['post', '/tenants/import/preview'], ['post', '/tenants/adopt']] as const) {
      const response = await (request(server) as any)[method](url).send({});
      expect(response.status, `${method.toUpperCase()} ${url}`).toBe(403);
      expect(response.body.error).toBe('platform_admin_required');
    }
  });

  it('refuses a non-admin before it ever asks who is a platform admin', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const response = await request(app('9', ['customer'], ['9'])).get('/tenants/');
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('forbidden');
  });

  it('lets a platform admin list sites', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const response = await request(app('1', ['admin'], ['1'])).get('/tenants/');
    expect(response.status).toBe(200);
    expect(response.body.multiTenant).toBe(true);
    expect(response.body.tenants).toEqual([]);
  });
});
