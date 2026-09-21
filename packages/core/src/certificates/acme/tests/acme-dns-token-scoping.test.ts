import { beforeEach, describe, expect, it } from 'vitest';
import { AcmeCloudflareTokenStore } from '@core/certificates/acme/dns/acme-cloudflare-token-store';
import { AcmeDnsTokenResolver } from '@core/certificates/acme/dns/acme-dns-token-resolver';
import { AcmeTokenScope } from '@core/certificates/acme/enums/acme-token-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * A Cloudflare token belongs to whoever owns the DNS, which on a multi-tenant platform is normally
 * the CUSTOMER — their domain lives in their own Cloudflare account. A single platform-wide token
 * forces one of two bad outcomes: the platform holds DNS-write on every customer's zones, or DNS-01
 * is impossible for any domain not in the platform's account while the admin still offers
 * "Automatic (wildcard)" on that site's host.
 *
 * The trap these tests exist for: `certificate_acme_cloudflare_token` is declared
 * `SettingScope.PLATFORM`, and the row-level-security policy is generated from that declaration, so
 * the PLATFORM row is deliberately visible from inside a tenant. Any access that leaned on ambient
 * scope would read the platform's token while standing in a site, and — far worse — a site's write
 * would silently rewrite the platform's row. Both fail without an error.
 */
describe('Cloudflare token scoping — per site, platform as fallback', () => {
  const KEY = SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN;
  let meta: Array<Record<string, any>>;
  /** Which RLS context each access ran in — the policy accepts only one of them per row. */
  let scopesUsed: string[];

  /** Minimal raw-manager fake. `findOne` matches on every column given, `tenant_id` included. */
  class FakeDb {
    constructor(private readonly table: Array<Record<string, any>>) {}
    async findOne(_n: string, where: Record<string, any>): Promise<Record<string, any> | null> {
      return this.table.find((row) => Object.entries(where).every(([k, v]) => (row[k] ?? null) === v)) ?? null;
    }
    async insert(_n: string, values: Record<string, any>): Promise<void> { this.table.push({ ...values }); }
    async update(_n: string, where: Record<string, any>, values: Record<string, any>): Promise<unknown> {
      const row = this.table.find((candidate) => Object.entries(where).every(([k, v]) => (candidate[k] ?? null) === v));
      if (!row) return null;
      Object.assign(row, values);
      return row;
    }
    async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> { scopesUsed.push('platform'); return fn(); }
    async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> { scopesUsed.push(`tenant:${tenantId}`); return fn(); }
  }

  const store = () => new AcmeCloudflareTokenStore(new FakeDb(meta));
  const resolve = (tenantId: string | null) => new AcmeDnsTokenResolver(store()).resolve(tenantId);

  beforeEach(() => {
    meta = [];
    scopesUsed = [];
    process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key-for-token-scoping';
  });

  it('uses the site\'s own token when it has one', async () => {
    await store().set('platform-token', null);
    await store().set('site-token', 'acme-shop');

    const resolved = await resolve('acme-shop');

    expect(resolved.scope).toBe(AcmeTokenScope.SITE);
    expect(resolved.token).toBe('site-token');
    expect(resolved.isPlatformFallback).toBe(false);
  });

  it('falls back to the platform token when the site has none', async () => {
    await store().set('platform-token', null);

    const resolved = await resolve('acme-shop');

    expect(resolved.scope).toBe(AcmeTokenScope.PLATFORM);
    expect(resolved.token).toBe('platform-token');
    expect(resolved.isPlatformFallback).toBe(true);
  });

  it('reports NONE — not a blank token — when neither scope has one', async () => {
    const resolved = await resolve('acme-shop');

    expect(resolved.scope).toBe(AcmeTokenScope.NONE);
    expect(resolved.isConfigured).toBe(false);
  });

  /**
   * The one that would be silent. A site's write must create its OWN row, not update the
   * platform's — which `findOne({ key })` alone would have done, because the platform row is
   * visible from inside a tenant by policy.
   */
  it('a site write never touches the platform row', async () => {
    await store().set('platform-token', null);
    await store().set('site-token', 'acme-shop');

    expect(meta).toHaveLength(2);
    const platformRow = meta.find((row) => (row.tenant_id ?? null) === null);
    const siteRow = meta.find((row) => row.tenant_id === 'acme-shop');
    expect(platformRow?.key).toBe(KEY);
    expect(siteRow?.key).toBe(KEY);
    expect((await resolve(null)).token).toBe('platform-token');
  });

  it('one site never reads another site\'s token', async () => {
    await store().set('a-token', 'site-a');

    const other = await resolve('site-b');

    expect(other.scope).toBe(AcmeTokenScope.NONE);
    expect(other.isConfigured).toBe(false);
  });

  it('clearing a site token falls back to the platform again, and leaves it intact', async () => {
    await store().set('platform-token', null);
    await store().set('site-token', 'acme-shop');
    await store().clear('acme-shop');

    const resolved = await resolve('acme-shop');

    expect(resolved.scope).toBe(AcmeTokenScope.PLATFORM);
    expect(resolved.token).toBe('platform-token');
    expect((await resolve(null)).token).toBe('platform-token');
  });

  it('a host owned by no site uses the platform token and never a site\'s', async () => {
    await store().set('site-token', 'acme-shop');

    const resolved = await resolve(null);

    expect(resolved.scope).toBe(AcmeTokenScope.NONE);
    expect(resolved.isConfigured).toBe(false);
  });

  /**
   * The failure this test exists for was NOT silent — Postgres refused the insert outright with
   * "new row violates row-level security policy". `_system_meta` admits a row only when its
   * `tenant_id` equals `app.tenant_id`, or when it is NULL and the caller is platform admin, so a
   * site's token written under `withPlatformAdmin` cannot be stored at all. Reads are the mirror:
   * a tenant's row is not visible from platform scope.
   */
  it('writes and reads a site token inside that tenant\'s own scope', async () => {
    await store().set('site-token', 'acme-shop');
    expect(scopesUsed).toEqual(['tenant:acme-shop']);

    scopesUsed = [];
    await resolve('acme-shop');
    expect(scopesUsed).toContain('tenant:acme-shop');
    expect(scopesUsed).not.toContain('platform');
  });

  it('writes and reads the platform token as platform admin', async () => {
    await store().set('platform-token', null);
    expect(scopesUsed).toEqual(['platform']);
  });

  it('stores ciphertext, never the token in the clear', async () => {
    await store().set('super-secret-token', 'acme-shop');

    const row = meta.find((candidate) => candidate.tenant_id === 'acme-shop');
    expect(String(row?.value)).not.toContain('super-secret-token');
    expect(String(row?.value)).toMatch(/^enc:/);
  });

  /** Asking which token applies must never decrypt — the admin does it on every page load. */
  it('reports configured without decrypting an unreadable token', async () => {
    meta.push({ key: KEY, tenant_id: 'acme-shop', value: 'enc:v1:garbage' });

    const resolved = await resolve('acme-shop');

    expect(resolved.isConfigured).toBe(true);
    expect(resolved.scope).toBe(AcmeTokenScope.SITE);
    expect(() => resolved.token).toThrow();
  });
});
