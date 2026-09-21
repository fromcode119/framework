import { SecretService } from '@core/security/secret-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The one write path for the Cloudflare API token, encrypted at rest.
 *
 * `_system_meta` rows are written in the clear by the generic settings PUT — fine for a directory
 * URL or an address, wrong for a credential with DNS edit rights. This is the same split the
 * platform already draws for integration provider secrets: the generic settings key is declared
 * NOT writable/exposed (see `SystemSettingRegistry`), and this is the only place that reads or
 * writes the row, always through `SecretService`. Nothing else ever sees the plaintext.
 *
 * SCOPED TO WHOEVER OWNS THE DNS. A token is a credential for somebody's Cloudflare account, and on
 * a multi-tenant platform that account is usually the CUSTOMER's, not ours. One shared platform
 * token would force exactly two bad outcomes: either the platform holds DNS-write on every
 * customer's zones, or DNS-01 is impossible for every domain that is not in the platform's own
 * account — while the admin still offers "Automatic (wildcard)" on that site's host. So a tenant
 * (site OR workspace) may store its own, and the platform row remains the fallback for hosts that
 * have none. `AcmeDnsTokenResolver` is what applies that precedence.
 *
 * TWO THINGS ARE REQUIRED TOGETHER, and each covers a different failure:
 *
 * 1. THE RIGHT SCOPE, because row-level security decides what may be written at all. `_system_meta`
 *    admits a row only when `tenant_id` equals `app.tenant_id`, or when it is NULL and the caller is
 *    platform admin. So a tenant's row must be written under `withTenant` — under `withPlatformAdmin`
 *    the insert is REFUSED outright ("new row violates row-level security policy"). The same asymmetry
 *    applies to reads: a tenant's row is not visible in platform scope at all.
 * 2. AN EXPLICIT `tenant_id` IN EVERY FILTER, because this key is declared `SettingScope.PLATFORM`
 *    and the policy is generated from that declaration — so the PLATFORM row IS deliberately visible
 *    from inside a tenant. A filter that leaned on scope alone would therefore read the platform's
 *    token while standing in a site, and an update would rewrite the platform's row from inside one.
 *    Unlike the first failure, this one is silent. Pinning the column is what tells the rows apart.
 */
export class AcmeCloudflareTokenStore {
  private static readonly TABLE = SystemConstants.TABLE.META;
  private static readonly KEY = SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN;

  constructor(private readonly db: any) {}

  /**
   * Store the token encrypted for one scope. Never logged, never echoed back.
   *
   * `tenantId` null is the platform's own token; a tenant id is that site's or workspace's.
   */
  async set(token: string, tenantId: string | null = null): Promise<void> {
    const trimmed = String(token ?? '').trim();
    if (!trimmed) {
      await this.clear(tenantId);
      return;
    }
    if (!SecretService.isEncryptionAvailable()) {
      throw new Error('Storing the Cloudflare token requires SECRET_KEY to be configured on the server.');
    }
    await this.write(SecretService.encrypt(trimmed), tenantId);
  }

  /**
   * Blank means this scope has no token — clearing the row is how that is expressed.
   *
   * Blanked rather than deleted, for a tenant as much as for the platform: an empty value reads as
   * "none here" and the resolver falls through to the platform, which is the same answer a missing
   * row gives. One write path is worth more than saving a row.
   */
  async clear(tenantId: string | null = null): Promise<void> {
    await this.write('', tenantId);
  }

  /**
   * The ciphertext stored for EXACTLY this scope, '' when there is none.
   *
   * NEVER DECRYPTS — the same rule `AcmeSettings.isCloudflareConfigured` follows, and for the same
   * reason: this is read on every Certificates page load, including for plain HTTP-01 hosts that
   * have nothing to do with Cloudflare, so a token whose ciphertext no longer decrypts (SECRET_KEY
   * rotated after it was saved) must not throw from here and take the whole screen down. The
   * decrypt happens only where an order is actually placed.
   */
  async readCiphertext(tenantId: string | null = null): Promise<string> {
    return this.inScope(tenantId, async () => {
      const row = await this.db.findOne(AcmeCloudflareTokenStore.TABLE, AcmeCloudflareTokenStore.filter(tenantId));
      return String(row?.value ?? '').trim();
    });
  }

  /** The row for one scope. `tenant_id: null` renders `IS NULL`, which is the platform's row. */
  private static filter(tenantId: string | null): Record<string, unknown> {
    return { key: AcmeCloudflareTokenStore.KEY, tenant_id: tenantId || null };
  }

  /**
   * Run inside the scope row-level security requires for this row: the tenant's own for a site or
   * workspace, platform-admin for the platform's. Not interchangeable — see the class note.
   */
  private async inScope<T>(tenantId: string | null, fn: () => Promise<T>): Promise<T> {
    return tenantId ? this.db.withTenant(tenantId, fn) : this.db.withPlatformAdmin(fn);
  }

  private async write(value: string, tenantId: string | null): Promise<void> {
    const filter = AcmeCloudflareTokenStore.filter(tenantId);
    await this.inScope(tenantId, async () => {
      const existing = await this.db.findOne(AcmeCloudflareTokenStore.TABLE, filter);
      if (existing) {
        await this.db.update(AcmeCloudflareTokenStore.TABLE, filter, { value, updated_at: new Date() });
        return;
      }
      await this.db.insert(AcmeCloudflareTokenStore.TABLE, { ...filter, value });
    });
  }
}
