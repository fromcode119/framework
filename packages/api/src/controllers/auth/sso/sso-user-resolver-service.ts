import * as jwt from 'jsonwebtoken';
import { PluginManager } from '@fromcode119/core';
import { SsoJwksKeyProvider } from './sso-jwks-key-provider';

// Provider verification metadata (issuer + JWKS endpoint). Plain literals — no domain logic, just the public
// OpenID endpoints for the two supported identity providers.
const PROVIDERS: Record<string, { issuer: string | string[]; jwksUri: string }> = {
  google: { issuer: ['https://accounts.google.com', 'accounts.google.com'], jwksUri: 'https://www.googleapis.com/oauth2/v3/certs' },
  apple: { issuer: 'https://appleid.apple.com', jwksUri: 'https://appleid.apple.com/auth/keys' },
};

/**
 * Resolves a verified user identity from a Google/Apple OIDC id-token. Registered on the
 * `auth:sso:resolve-user` hook, it verifies the token's signature (against the provider JWKS), issuer,
 * audience (the configured client IDs), and expiry, then returns `{ email, firstName, lastName, emailVerified }`
 * for `AuthControllerSso.ssoLogin` to create/log in the user.
 *
 * Audience validation is mandatory: the accepted client IDs come from the `sso` integration config
 * (`storedProviders[].clientId` / `clientIds` / `audience`). Without a configured client ID the provider is
 * rejected, so a token minted for a different app can never be accepted.
 */
export class SsoUserResolverService {
  private keys = new SsoJwksKeyProvider();

  constructor(private manager: PluginManager) {}

  async resolve(payload: any): Promise<any> {
    const provider = String(payload?.provider || '').trim().toLowerCase();
    const idToken = String(payload?.idToken || '').trim();
    const meta = PROVIDERS[provider];
    if (!meta) throw new Error(`SSO provider "${provider}" is not supported`);
    if (!idToken) throw new Error('An id token is required for SSO login');

    const audiences = await this.getAudiences(provider);
    if (audiences.length === 0) {
      throw new Error(`SSO provider "${provider}" is not configured (missing client ID)`);
    }

    const decoded: any = jwt.decode(idToken, { complete: true });
    const kid = decoded?.header?.kid;
    if (!kid) throw new Error('SSO token is missing a key id');

    const key = await this.keys.getKey(meta.jwksUri, String(kid));
    let claims: any;
    try {
      claims = (jwt.verify as any)(idToken, key, { algorithms: ['RS256'], issuer: meta.issuer, audience: audiences });
    } catch (err: any) {
      throw new Error(`SSO token verification failed: ${err?.message || 'invalid token'}`);
    }

    const email = String(claims?.email || '').trim().toLowerCase();
    if (!email) throw new Error('SSO token did not include an email address');
    const emailVerified = claims?.email_verified !== false && claims?.email_verified !== 'false';

    // Google supplies the name in the token; Apple only sends it on first authorization, forwarded by the
    // client in `profile.name`.
    const profileName = String(payload?.profile?.name || '').trim();
    const [pFirst, ...pRest] = profileName.split(/\s+/).filter(Boolean);
    const firstName = String(claims?.given_name || pFirst || '').trim() || null;
    const lastName = String(claims?.family_name || pRest.join(' ') || '').trim() || null;

    return { email, firstName, lastName, emailVerified };
  }

  private async getAudiences(provider: string): Promise<string[]> {
    let config: any = null;
    try {
      config = await (this.manager.integrations as any).getConfig('sso');
    } catch {
      return [];
    }
    const entries = Array.isArray(config?.storedProviders) ? config.storedProviders : [];
    const match = entries.find((e: any) => String(e?.providerKey || '').trim().toLowerCase() === provider);
    const raw = [
      ...(Array.isArray(match?.clientIds) ? match.clientIds : []),
      match?.clientId,
      match?.audience,
      ...(Array.isArray(match?.audiences) ? match.audiences : []),
    ];
    return Array.from(new Set(raw.map((v) => String(v || '').trim()).filter(Boolean)));
  }
}
