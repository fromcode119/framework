import express from 'express';
import request from 'supertest';
import { AppearanceManager, SystemConstants, TenantMode } from '@fromcode119/core';
import { AppearanceRouter } from '@api/routes/appearances';

/**
 * An appearance is a BRANDED admin console, so the installed set is a roll-call of the customers on
 * the box. Listing it to a tenant-bound request named them — and offered a Remove next to each.
 *
 * The two tenant kinds are opposites here, and getting them the wrong way round is silent:
 *
 *   workspace — its console is locked to one appearance by its KIND. `/system/admin/settings`
 *               answers a write of `admin_appearance` for a workspace with 403 `kind_locks_appearance`,
 *               so every extra option a picker offered it would be refused.
 *   site      — DOES choose, through the per-site `admin_appearance` setting. Handing it an empty
 *               list would take away a capability the product has.
 */

const passthrough = (_req: any, _res: any, next: () => void) => next();

const INSTALLED = [
  { slug: 'default', name: 'Default', version: '', builtIn: true },
  { slug: 'aurora', name: 'Aurora', version: '1.0.0', builtIn: false, sourceUrl: 'https://market.example/aurora.zip' },
  { slug: 'nocturne', name: 'Nocturne', version: '2.0.0', builtIn: false, sourceUrl: 'https://market.example/nocturne.zip' },
];

/** `_system_meta` as the request connection sees it: this site's rows, already scoped by RLS. */
const metaWith = (adminAppearance?: string) => ({
  findOne: vi.fn(async (_table: string, where: { key: string }) =>
    (where.key === SystemConstants.META_KEY.ADMIN_APPEARANCE && adminAppearance !== undefined
      ? { key: where.key, value: adminAppearance }
      : null)),
} as any);

function buildApp(bind?: { tenantId: string; tenant: unknown }, adminAppearance?: string) {
  vi.spyOn(AppearanceManager.prototype, 'list').mockReturnValue(INSTALLED as any);
  const auth: any = { middleware: () => passthrough, guard: () => passthrough };
  const platformAdmin: any = { middleware: () => passthrough };

  const app = express();
  app.use(express.json());
  if (bind) app.use((req: any, _res, next) => { req.tenantId = bind.tenantId; req.tenant = bind.tenant; next(); });
  app.use('/api/v1/appearances', new AppearanceRouter(auth, platformAdmin, metaWith(adminAppearance)).router);
  return app;
}

const slugsOf = (body: any) => body.appearances.map((entry: any) => entry.slug).sort();

afterEach(() => { TenantMode.reset(); vi.restoreAllMocks(); });

describe('the appearance list never recites the platform inventory to a tenant', () => {
  it('shows a SITE the built-in console plus the one it wears — never another customer brand', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

    const response = await request(buildApp({ tenantId: 'site-a', tenant: { isWorkspace: false } }, 'aurora'))
      .get('/api/v1/appearances');

    expect(response.status).toBe(200);
    expect(slugsOf(response.body)).toEqual(['aurora', 'default']);
  });

  it("KEEPS a site's picker rather than emptying it: `admin_appearance` is a per-site setting it may change", async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

    const response = await request(buildApp({ tenantId: 'site-a', tenant: { isWorkspace: false } }))
      .get('/api/v1/appearances');

    // No appearance set yet — it still gets the built-in default to choose, not nothing at all.
    expect(slugsOf(response.body)).toEqual(['default']);
  });

  it('shows a WORKSPACE only the appearance its kind locks it to', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

    const response = await request(buildApp({ tenantId: 'ws-a', tenant: { isWorkspace: true, appearance: 'nocturne' } }))
      .get('/api/v1/appearances');

    // Not `default` as well: a workspace cannot switch to it — the settings write answers 403.
    expect(slugsOf(response.body)).toEqual(['nocturne']);
  });

  it("shows a workspace on the default console just that, when its appearance is ''", async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

    const response = await request(buildApp({ tenantId: 'ws-a', tenant: { isWorkspace: true, appearance: '' } }))
      .get('/api/v1/appearances');

    expect(slugsOf(response.body)).toEqual(['default']);
  });

  it('strips `sourceUrl` from every tenant-scoped answer — it is the package address, platform detail', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

    const response = await request(buildApp({ tenantId: 'site-a', tenant: { isWorkspace: false } }, 'aurora'))
      .get('/api/v1/appearances');

    expect(response.body.appearances.every((entry: any) => entry.sourceUrl === undefined)).toBe(true);
  });

  it('still answers the full inventory in PLATFORM scope, where the operator installs and assigns', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

    const response = await request(buildApp()).get('/api/v1/appearances');

    expect(slugsOf(response.body)).toEqual(['aurora', 'default', 'nocturne']);
    expect(response.body.appearances.find((entry: any) => entry.slug === 'aurora').sourceUrl)
      .toBe('https://market.example/aurora.zip');
  });

  it('leaves a SINGLE-TENANT deployment alone', async () => {
    const response = await request(buildApp({ tenantId: 'site-a', tenant: { isWorkspace: false } }, 'aurora'))
      .get('/api/v1/appearances');

    expect(slugsOf(response.body)).toEqual(['aurora', 'default', 'nocturne']);
  });
});
