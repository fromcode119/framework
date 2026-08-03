import { randomBytes } from 'crypto';
import { SystemConstants } from '@fromcode119/core';

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
