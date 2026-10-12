import { afterEach, describe, expect, it, vi } from 'vitest';
import { CookieConstants, SitePreviewGrantService, TenantMembershipService } from '@fromcode119/core';
import { SitePreviewViewer } from '@api/services/tenants/site-preview-viewer';

/** The same in-memory stand-in the grant-service suite uses — see its comment on `= NULL`. */
class FakeDb {
  /** The tenant this connection is bound to. Only `withTenant` sets it — unbound is the platform. */
  private bound: string | null = null;

  /** Row-level security is enforced against the CONNECTION, so the grant service binds the site
   *  before writing a row that names it. See the grant-service suite. */
  async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    const outer = this.bound;
    this.bound = tenantId;
    try { return await fn(); } finally { this.bound = outer; }
  }

  readonly rows: Array<Record<string, any>> = [];
  async insert(_t: string, row: Record<string, any>): Promise<void> { this.rows.push({ ...row }); }
  async findOne(_t: string, where: Record<string, any>): Promise<Record<string, any> | null> {
    return this.rows.find((row) => FakeDb.matches(row, where)) ?? null;
  }
  async find(_t: string): Promise<Array<Record<string, any>>> { return [...this.rows]; }
  async update(_t: string, where: Record<string, any>, patch: Record<string, any>): Promise<boolean> {
    const row = this.rows.find((candidate) => FakeDb.matches(candidate, where));
    if (!row) return false;
    Object.assign(row, patch);
    return true;
  }
  private static matches(row: Record<string, any>, where: Record<string, any>): boolean {
    // `= NULL` is true of nothing — see the class comment.
    return Object.entries(where).every(([key, value]) => value !== null && value !== undefined && row[key] === value);
  }
}

const request = (cookie?: string): any => ({ cookies: cookie ? { [CookieConstants.SITE_PREVIEW]: cookie } : {} });

const membership = (options: { platformAdmin?: boolean; roles?: string[] | null }) => {
  vi.spyOn(TenantMembershipService.prototype, 'isPlatformAdminAccount').mockResolvedValue(options.platformAdmin === true);
  vi.spyOn(TenantMembershipService.prototype, 'rolesForTenant').mockResolvedValue(options.roles ?? null);
};

const sessionFor = async (db: FakeDb, tenantId: string, userId: string): Promise<string> => {
  const grants = new SitePreviewGrantService(db);
  return grants.exchange(await grants.issue(tenantId, userId), tenantId);
};

describe('SitePreviewViewer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads as the administrator of THIS site who opened the preview', async () => {
    const db = new FakeDb();
    membership({ roles: ['admin'] });
    const viewer = await new SitePreviewViewer(db).of('acme', request(await sessionFor(db, 'acme', '7')));
    expect(viewer).toEqual({ id: '7', roles: ['admin'], permissions: [] });
  });

  it('reads as a platform admin who opened the preview', async () => {
    const db = new FakeDb();
    membership({ platformAdmin: true });
    expect((await new SitePreviewViewer(db).of('acme', request(await sessionFor(db, 'acme', '1'))))?.id).toBe('1');
  });

  it('stops opening drafts once that person is no longer an administrator of the site', async () => {
    // The session lasts two hours; the right to see drafts is checked on every request.
    const db = new FakeDb();
    const session = await sessionFor(db, 'acme', '7');
    membership({ roles: ['editor'] });
    expect(await new SitePreviewViewer(db).of('acme', request(session))).toBeNull();
  });

  it('is nobody without a session, with a forged one, or with another site\'s', async () => {
    const db = new FakeDb();
    membership({ platformAdmin: true });
    const session = await sessionFor(db, 'acme', '1');
    const viewer = new SitePreviewViewer(db);
    expect(await viewer.of('acme', request())).toBeNull();
    expect(await viewer.of('acme', request('forged'))).toBeNull();
    expect(await viewer.of('globex', request(session))).toBeNull();
    expect(await viewer.of('', request(session))).toBeNull();
  });
});
