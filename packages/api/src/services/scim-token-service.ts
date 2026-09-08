import { randomBytes } from 'crypto';
import { SystemConstants, TenantMode, TenantRecord } from '@fromcode119/core';

/**
 * Manages the SCIM bearer token — the single secret the tenant's IdP authenticates with. Stored in
 * system meta (env `SCIM_BEARER_TOKEN` overrides). No token configured = SCIM disabled (fail-closed):
 * every provisioning call is rejected until an admin rotates one in. Rotating returns the new token ONCE.
 */
export class ScimTokenService {
  private static readonly TOKEN_KEY = 'scim:token';

  constructor(private readonly db: any) {}

  async current(): Promise<string> {
    const fromEnv = String(process.env.SCIM_BEARER_TOKEN || '').trim();
    if (fromEnv) return fromEnv;
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: ScimTokenService.TOKEN_KEY }).catch(() => null);
    return String(row?.value || '').trim();
  }

  async isConfigured(): Promise<boolean> {
    return (await this.current()).length > 0;
  }

  /**
   * WHICH SITE a presented token belongs to, or `null` when it matches none.
   *
   * The token is stored per site (`scim:token` lives in the tenant-scoped settings table), so the token
   * IS the site's name — the same way an MCP token is bound to its site rather than naming one in the
   * URL. That matters because the alternative was worse than undecided: read untenanted, the lookup saw
   * only the PLATFORM row, so provisioning either failed or would have created accounts belonging to no
   * site at all.
   *
   * Each candidate is read inside its own tenant scope because row-level security is what separates
   * these rows; there is no cross-tenant read of settings, by design. A deployment has a handful of
   * sites and an IdP calls rarely, so the loop is cheaper than any cache that could go stale.
   *
   * `''` (empty) is the answer for a single-tenant deployment: there is one site and the platform row
   * is its row, exactly as before tenancy existed.
   */
  async resolveTenant(presented: string): Promise<string | null> {
    if (!presented) return null;
    if (!TenantMode.isEnabled()) return (await this.matches(presented)) ? '' : null;

    const envToken = String(process.env.SCIM_BEARER_TOKEN || '').trim();
    if (envToken) return ScimTokenService.equals(envToken, presented) ? '' : null;

    // The registry itself carries no row-level security (tenancy resolution cannot be tenant-scoped),
    // so the candidate list is a plain read; only each site's SETTINGS need its own scope below.
    const rows = await this.db.find(SystemConstants.TABLE.TENANTS, {}).catch(() => [] as any[]);
    for (const row of (Array.isArray(rows) ? rows : [])) {
      const tenant = TenantRecord.from(row);
      if (!tenant?.isActive) continue;
      const stored = await this.db.withTenant(tenant.id, async () => {
        const row = await this.db.findOne(SystemConstants.TABLE.META, { key: ScimTokenService.TOKEN_KEY }).catch(() => null);
        return String(row?.value || '').trim();
      }).catch(() => '');
      if (stored && ScimTokenService.equals(stored, presented)) return tenant.id;
    }
    return null;
  }

  /** Length-checked, constant-time-ish equality — never a plain `===` on a secret. */
  private static equals(token: string, presented: string): boolean {
    if (!token || !presented || token.length !== presented.length) return false;
    let diff = 0;
    for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ presented.charCodeAt(i);
    return diff === 0;
  }

  /** Timing-safe-ish comparison of a presented bearer token against the configured one. */
  async matches(presented: string): Promise<boolean> {
    const token = await this.current();
    if (!token || !presented) return false;
    if (token.length !== presented.length) return false;
    let diff = 0;
    for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ presented.charCodeAt(i);
    return diff === 0;
  }

  /** Generate + persist a fresh token, returning it once (never stored in plaintext elsewhere). */
  async rotate(): Promise<string> {
    const token = 'scim_' + randomBytes(24).toString('hex');
    const now = new Date();
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key: ScimTokenService.TOKEN_KEY }).catch(() => null);
    if (existing) await this.db.update(SystemConstants.TABLE.META, { key: ScimTokenService.TOKEN_KEY }, { value: token, updatedAt: now });
    else await this.db.insert(SystemConstants.TABLE.META, { key: ScimTokenService.TOKEN_KEY, value: token, updatedAt: now });
    return token;
  }
}
