import { describe, expect, it } from 'vitest';
import { CookieConstants, SitePreviewGrantService, TenantRecord } from '@fromcode119/core';
import { SiteVisibilityGate } from '@api/server/site-visibility-gate';

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

const site = (visibility: string): TenantRecord => TenantRecord.from({
  id: 'acme', slug: 'acme', primary_host: 'acme.test', host_aliases: '[]', state: 'active', visibility,
});

const request = (overrides: Record<string, unknown> = {}): any => ({ path: '/api/v1/content', cookies: {}, ...overrides });

describe('SiteVisibilityGate', () => {
  it('serves a public site to anyone', async () => {
    expect(await new SiteVisibilityGate(new FakeDb()).allows(site('public'), request())).toBe(true);
  });

  it('refuses a private site to a caller with no credential of any kind', async () => {
    const gate = new SiteVisibilityGate(new FakeDb());
    expect(await gate.canPreview(site('private'), request())).toBe(false);
    expect(await gate.allows(site('private'), request())).toBe(false);
  });

  it('recognises a live preview cookie for THIS site', async () => {
    const db = new FakeDb();
    const grants = new SitePreviewGrantService(db);
    const session = await grants.exchange(await grants.issue('acme', '7'), 'acme');
    const req = request({ cookies: { [CookieConstants.SITE_PREVIEW]: session } });

    expect(await new SiteVisibilityGate(db).allows(site('private'), req)).toBe(true);
  });

  it('does not recognise that cookie on a different site', async () => {
    const db = new FakeDb();
    const grants = new SitePreviewGrantService(db);
    const session = await grants.exchange(await grants.issue('acme', '7'), 'acme');
    const other = TenantRecord.from({ id: 'globex', slug: 'globex', primary_host: 'globex.test', host_aliases: '[]', state: 'active', visibility: 'private' });

    expect(await new SiteVisibilityGate(db).allows(other, request({ cookies: { [CookieConstants.SITE_PREVIEW]: session } }))).toBe(false);
  });

  it('answers the preview exchange itself on a closed site — the request that lifts the refusal', async () => {
    // Without this the operator's link would be refused by the very gate it exists to get past.
    const req = request({ path: '/api/v1/system/site-preview/exchange/abc' });
    expect(await new SiteVisibilityGate(new FakeDb()).allows(site('private'), req)).toBe(true);
  });

  it('does not treat an arbitrary path that merely contains the exchange text as the exchange', async () => {
    const req = request({ path: '/api/v1/content/api/v1/system/site-preview/exchange/abc' });
    expect(await new SiteVisibilityGate(new FakeDb()).allows(site('private'), req)).toBe(false);
  });
});
