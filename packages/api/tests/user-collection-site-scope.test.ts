import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils, SystemConstants, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { RESTController } from '@api/controllers/rest/rest-controller';
import { UserCollectionScopeGuard } from '@api/services/user-collection-scope-guard';
import { VersioningService } from '@api/services/versioning-service';
import { ErrorResponseMiddleware } from '@api/middlewares/error-response-middleware';

/**
 * The generic collection API is a second door onto the `users` table, and it applied none of the
 * narrowing the Users screens carry. Measured locally before this change: the administrator of one
 * site — not a platform admin — listed all 32 accounts on the platform where the site has 2 members,
 * and rewrote the email, roles and password of a customer who belongs to a different site.
 *
 * A site's users are its members, platform admin included. The platform-wide list is the PLATFORM
 * scope's, and only a platform admin's.
 */
const users: any = {
  slug: 'users',
  tableName: SystemConstants.TABLE.USERS,
  system: true,
  fields: [
    { name: 'email', type: 'text' },
    { name: 'password', type: 'password' },
    { name: 'firstName', type: 'text' },
  ],
};
const pages: any = { slug: 'pages', tableName: 'cms_pages', fields: [{ name: 'title', type: 'text' }] };

const SITE_MEMBERS = [2, 287];
const OUTSIDER = 288;

function database() {
  return {
    dialect: 'postgres',
    find: vi.fn(async () => []),
    findOne: vi.fn(async (_table: unknown, where: any) => ({ id: where?.id, email: 'x@y.test', password: '$2b$12$hash' })),
    count: vi.fn(async () => 0),
    insert: vi.fn(async (_table: unknown, data: any) => ({ id: 999, ...data })),
    update: vi.fn(async (_table: unknown, where: any, data: any) => ({ ...where, ...data })),
    delete: vi.fn(async () => true),
    upsert: vi.fn(),
    and: vi.fn((...chunks: unknown[]) => ({ and: chunks })),
    or: vi.fn((...chunks: unknown[]) => ({ or: chunks })),
    eq: vi.fn((column: unknown, value: unknown) => ({ eq: value })),
    desc: vi.fn(() => ({})),
    asc: vi.fn(() => ({})),
    inArray: vi.fn((_column: unknown, values: unknown[]) => ({ inArray: values })),
  } as any;
}

function response() {
  const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  res.setHeader = vi.fn((name: string, value: string) => { res.headers[name] = value; });
  res.send = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}

function controllerOver(db: any) {
  const controller = new RESTController(db);
  const runtime = (controller as any).runtime;
  // Access policy and logging are not what is under test: the caller here IS an admin of the site.
  runtime.accessPolicy = {
    resolveReadConstraints: vi.fn(async () => ({})),
    matchesReadConstraints: vi.fn(() => true),
    ensureCreateAllowed: vi.fn(async () => undefined),
    ensureUpdateAllowed: vi.fn(async () => undefined),
    ensureDeleteAllowed: vi.fn(async () => undefined),
  };
  runtime.logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  runtime.fieldGuard = {
    extractReadOnlyOverrideMetadata: (data: any) => ({ data: { ...(data || {}) }, overrideMeta: { fields: new Set() } }),
    enforceReadOnlyFieldConstraints: vi.fn(async () => undefined),
    assertPermalinkNotReserved: vi.fn(),
  };
  runtime.localization = { getLocaleContext: vi.fn(async () => ({})), transformOutgoingData: (_c: unknown, d: any) => d };
  runtime.processor = {
    processIncomingData: vi.fn(async (_c: unknown, data: any) => data),
    filterHiddenFields: (_c: unknown, data: any) => data,
  };
  runtime.versioningService = { createSnapshot: vi.fn(async () => undefined) };
  return controller;
}

function inSite(tenantId: string | undefined, { platformAdmin = false } = {}) {
  vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(tenantId as any);
  vi.spyOn(TenantMembershipService.prototype, 'listUserIdsForTenant').mockResolvedValue(SITE_MEMBERS);
  vi.spyOn(TenantMembershipService.prototype, 'isPlatformAdminAccount').mockResolvedValue(platformAdmin);
}

const request = (extra: Record<string, unknown> = {}) => ({ user: { id: '287', roles: ['admin'] }, query: {}, params: {}, body: {}, ...extra });

beforeEach(() => {
  TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  TenantMode.reset();
});

describe('UserCollectionScopeGuard', () => {
  it('recognises the identity table by TABLE, so re-registering the collection cannot step around it', () => {
    expect(UserCollectionScopeGuard.guards(users)).toBe(true);
    expect(UserCollectionScopeGuard.guards({ ...users, slug: 'accounts' })).toBe(true);
    expect(UserCollectionScopeGuard.guards(pages)).toBe(false);
  });

  it('narrows a site scope to its members — a platform admin included', async () => {
    inSite('t2', { platformAdmin: true });
    const scope = await UserCollectionScopeGuard.scopeFor(users, request(), database());
    expect(scope?.ids).toEqual(SITE_MEMBERS);
    expect(JSON.stringify(UserCollectionScopeGuard.buildReadClause(scope))).toContain('287');
  });

  it('leaves the platform scope unrestricted for a platform admin, and EMPTY for anyone else', async () => {
    inSite(undefined, { platformAdmin: true });
    const platform = await UserCollectionScopeGuard.scopeFor(users, request(), database());
    expect(platform?.ids).toBeNull();
    expect(UserCollectionScopeGuard.buildReadClause(platform)).toBeNull();

    vi.restoreAllMocks();
    inSite(undefined, { platformAdmin: false });
    const stranger = await UserCollectionScopeGuard.scopeFor(users, request(), database());
    expect(stranger?.ids).toEqual([]);
    // "No accounts" is a clause that matches nothing — never the absence of a filter.
    expect(JSON.stringify(UserCollectionScopeGuard.buildReadClause(stranger))).toContain('1 = 0');
  });

  it('answers null for every other collection, without asking who the caller is', async () => {
    const lookup = vi.spyOn(TenantMembershipService.prototype, 'listUserIdsForTenant');
    expect(await UserCollectionScopeGuard.scopeFor(pages, request(), database())).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('/collections/users inside a site', () => {
  it('lists only the site members', async () => {
    inSite('t2');
    const db = database();
    await controllerOver(db).find(users, request(), response());

    const where = db.find.mock.calls[0][1].where;
    expect(JSON.stringify(where)).toContain('287');
    expect(JSON.stringify(db.count.mock.calls[0][1].where)).toContain('287');
  });

  it('does not narrow another collection', async () => {
    inSite('t2');
    const db = database();
    await controllerOver(db).find(pages, request(), response());
    expect(db.find.mock.calls[0][1].where).toBeUndefined();
  });

  it('answers NOT FOUND for an account outside the site, without reading it', async () => {
    inSite('t2');
    const db = database();
    const res = response();
    await controllerOver(db).findOne(users, request({ params: { id: String(OUTSIDER) } }), res);
    expect(res.statusCode).toBe(404);
    expect(db.findOne).not.toHaveBeenCalled();
  });

  it('still serves a member', async () => {
    inSite('t2');
    const res = response();
    await controllerOver(database()).findOne(users, request({ params: { id: '287' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: 287 });
  });

  it('refuses to update an account outside the site — email, roles and password untouched', async () => {
    inSite('t2');
    const db = database();
    const res = response();
    await controllerOver(db).update(users, request({
      params: { id: String(OUTSIDER) },
      body: { email: 'taken@over.test', roles: ['admin'], password: 'x' },
    }), res);
    expect(res.statusCode).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('refuses to delete an account outside the site', async () => {
    inSite('t2');
    const db = database();
    const res = response();
    await controllerOver(db).delete(users, request({ params: { id: String(OUTSIDER) } }), res);
    expect(res.statusCode).toBe(404);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('refuses to CREATE an account, which would belong to no site', async () => {
    inSite('t2');
    const db = database();
    const res = response();
    await controllerOver(db).create(users, request({ body: { email: 'new@x.test', password: 'p' } }), res);
    expect(res.statusCode).toBe(403);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('bulk-updates only members and bulk-deletes only members', async () => {
    inSite('t2');
    const db = database();
    const controller = controllerOver(db);

    await controller.bulkUpdate(users, request({ body: { ids: ['287', String(OUTSIDER)], data: { firstName: 'X' } } }), response());
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.update.mock.calls[0][1]).toEqual({ id: 287 });

    const res = response();
    await controller.bulkDelete(users, request({ body: { ids: [String(OUTSIDER)] } }), res);
    expect(db.delete).not.toHaveBeenCalled();
    expect(res.body).toEqual({ success: false, count: 0 });
  });

  it('exports only the members', async () => {
    inSite('t2');
    const db = database();
    await controllerOver(db).export(users, request({ query: { format: 'json' } }) as any, response());
    expect(JSON.stringify(db.find.mock.calls[0][1].where)).toContain('287');
  });

  it('refuses the version history of an account outside the site', async () => {
    inSite('t2');
    const res = response();
    await controllerOver(database()).getVersions(users, request({ params: { id: String(OUTSIDER) } }), res);
    expect(res.statusCode).toBe(404);
  });
});

describe('/collections/users in the platform scope', () => {
  it('is the whole platform for a platform admin', async () => {
    inSite(undefined, { platformAdmin: true });
    const db = database();
    const res = response();
    await controllerOver(db).findOne(users, request({ params: { id: String(OUTSIDER) } }), res);
    expect(res.statusCode).toBe(200);
    await controllerOver(db).create(users, request({ body: { email: 'new@x.test', password: 'p' } }), response());
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('is nobody for an admin who is not a platform admin', async () => {
    inSite(undefined, { platformAdmin: false });
    const db = database();
    const res = response();
    await controllerOver(db).findOne(users, request({ params: { id: '287' } }), res);
    expect(res.statusCode).toBe(404);
  });
});

describe('version snapshots never carry a password field', () => {
  it('snapshots an account without its hash', async () => {
    const db = database();
    await new VersioningService(db).createSnapshot(users, 5, { id: 5, email: 'a@b.test', password: '$2b$12$hash' }, { id: 1 }, 'edit');
    const stored = db.insert.mock.calls[0][1].version_data;
    expect(stored).toEqual({ id: 5, email: 'a@b.test' });
  });

  it('serves a snapshot written before this change without its hash', async () => {
    const db = database();
    db.find.mockResolvedValue([{ ref_collection: 'users', ref_id: '5', version: 1, version_data: { email: 'a@b.test', password: '$2b$12$hash' } }]);
    const service = new VersioningService(db);
    service.useCollectionLookup((slug) => (slug === 'users' ? users : undefined));

    const one: any = await service.getVersion('users', 5, 1);
    expect(one.version_data).toEqual({ email: 'a@b.test' });
    const list: any = await service.getVersions('users', 5);
    expect(list.docs[0].version_data).toEqual({ email: 'a@b.test' });
  });

  it('never restores an old password', async () => {
    const db = database();
    db.find.mockResolvedValue([{ ref_collection: 'users', ref_id: '5', version: 1, version_data: JSON.stringify({ email: 'a@b.test', password: '$2b$12$old' }) }]);
    const service = new VersioningService(db);
    await service.restoreVersion(users, 5, 1, { id: 1 });
    expect(db.update.mock.calls[0][2]).toEqual({ email: 'a@b.test' });
  });

  it('strips a multi-word password field under its physical column name too', () => {
    const vault: any = { slug: 'vault', fields: [{ name: 'apiSecret', type: 'password' }, { name: 'label', type: 'text' }] };
    expect(VersioningService.withoutPasswordFields(vault, { label: 'x', api_secret: 's', apiSecret: 's' })).toEqual({ label: 'x' });
  });

  it('leaves collections without a password field as they are', () => {
    expect(VersioningService.withoutPasswordFields(pages, { title: 'Home' })).toEqual({ title: 'Home' });
  });
});

describe('ErrorResponseMiddleware', () => {
  it('grants no CORS to the origin of a failed request — the allowlist decides that, not the error path', () => {
    const logger: any = { error: vi.fn() };
    const res = response();
    res.headersSent = false;
    const handler = new ErrorResponseMiddleware(logger).middleware();
    handler(new Error('Not allowed by CORS'), { headers: { origin: 'https://evil.example' }, method: 'GET', originalUrl: '/x' } as any, res, vi.fn());
    expect(res.statusCode).toBe(500);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(res.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });
});
