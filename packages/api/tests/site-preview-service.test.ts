import { describe, expect, it } from 'vitest';
import { SitePreviewGrantService, TenantRecord } from '@fromcode119/core';
import { SitePreviewService } from '@api/services/tenants/site-preview-service';

/** See the grant-service suite for why `= NULL` matches nothing here too. */
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
    return this.rows.find((row) => Object.entries(where).every(([k, v]) => v !== null && v !== undefined && row[k] === v)) ?? null;
  }
  async update(): Promise<boolean> { return true; }
}

const tenants = (site: TenantRecord | null): any => ({ resolveById: async () => site });

const memberships = (options: { platformAdmin?: boolean; roles?: string[] | null }): any => ({
  isPlatformAdminAccount: async () => options.platformAdmin === true,
  rolesForTenant: async () => options.roles ?? null,
});

const acme = TenantRecord.from({
  id: 'acme', slug: 'acme', primary_host: 'Acme.Example.COM', host_aliases: '[]', state: 'active', visibility: 'private',
});

const service = (options: { site?: TenantRecord | null; platformAdmin?: boolean; roles?: string[] | null }, db = new FakeDb()) =>
  new SitePreviewService(tenants(options.site === undefined ? acme : options.site), new SitePreviewGrantService(db), memberships(options));

describe('SitePreviewService', () => {
  it('gives a platform admin a link on the site\'s own host, to the exchange route', async () => {
    const url = await service({ platformAdmin: true }).issueLink('acme', '7', 'https');
    expect(url.startsWith('https://acme.example.com/')).toBe(true);
    expect(url).toContain('/system/site-preview/exchange/');
  });

  it('gives an administrator OF THIS SITE a link', async () => {
    expect(await service({ roles: ['admin'] }).issueLink('acme', '7', 'https')).toContain('acme.example.com');
  });

  it('refuses somebody who merely holds the admin role somewhere else', async () => {
    // On a multi-site platform every customer's own administrator holds `admin`. Membership of THIS
    // site is the question, and a link is the thing being handed out.
    expect(await service({ roles: null }).issueLink('acme', '7', 'https')).toBe('');
    expect(await service({ roles: ['editor'] }).issueLink('acme', '7', 'https')).toBe('');
  });

  it('mints NOTHING when it refuses — a refused request must not leave a spendable grant behind', async () => {
    const db = new FakeDb();
    await service({ roles: null }, db).issueLink('acme', '7', 'https');
    expect(db.rows).toHaveLength(0);
  });

  it('refuses a site that does not exist, with the same answer as a site you may not see', async () => {
    expect(await service({ site: null, platformAdmin: true }).issueLink('ghost', '7', 'https')).toBe('');
  });

  it('keeps the scheme the operator is already using rather than assuming https', async () => {
    // A local stack serves both the console and the sites over plain HTTP; a hardcoded https there
    // produces a link that cannot connect.
    expect(await service({ platformAdmin: true }).issueLink('acme', '7', 'http')).toMatch(/^http:\/\//);
    expect(await service({ platformAdmin: true }).issueLink('acme', '7', '')).toMatch(/^https:\/\//);
  });
});
