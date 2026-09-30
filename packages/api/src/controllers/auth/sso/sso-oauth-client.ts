import * as jwt from 'jsonwebtoken';
import { SsoOauthProvider } from '@api/controllers/auth/sso/enums/sso-oauth-provider.enum';
import { SsoIdentity } from '@api/controllers/auth/sso/sso-identity';

/**
 * The provider side of a redirect sign-in (OAuth 2.0 authorization code with PKCE): the address the
 * visitor is sent to, and the code exchange that turns the provider's answer into an {@link SsoIdentity}.
 *
 * `config` is the provider's entry from Settings → Integrations → Federated Login, secrets decrypted.
 * An id token read here arrives on the back channel, straight from the token endpoint over TLS, which
 * OpenID Connect Core §3.1.3.7 accepts in place of a signature check; its audience, issuer and expiry
 * are still checked.
 */
export class SsoOauthClient {
  private static readonly TIMEOUT_MS = 10_000;

  constructor(private readonly provider: SsoOauthProvider, private readonly config: Record<string, any>) {}

  /** Whether this provider has everything a redirect sign-in needs. */
  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret && SsoOauthClient.isHttpUrl(this.authorizeEndpoint) && SsoOauthClient.isHttpUrl(this.tokenEndpoint));
  }

  authorizationUrl(redirectUri: string, state: string, challenge: string): string {
    const url = new URL(this.authorizeEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', this.scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async identify(code: string, redirectUri: string, verifier: string): Promise<SsoIdentity> {
    const tokens = await this.exchange(code, redirectUri, verifier);
    if (this.provider === SsoOauthProvider.GITHUB) return this.githubIdentity(String(tokens.access_token || ''));
    if (this.userInfoEndpoint) return this.userInfoIdentity(String(tokens.access_token || ''));
    return this.idTokenIdentity(String(tokens.id_token || ''));
  }

  private get clientId(): string { return String(this.config?.clientId || '').trim(); }
  private get clientSecret(): string { return String(this.config?.clientSecret || '').trim(); }
  private get scopes(): string { return String(this.config?.scopes || '').trim() || this.provider.defaultScopes; }
  private get authorizeEndpoint(): string { return this.provider.authorizeUrl || String(this.config?.authorizeUrl || '').trim(); }
  private get tokenEndpoint(): string { return this.provider.tokenUrl || String(this.config?.tokenUrl || '').trim(); }
  private get userInfoEndpoint(): string {
    return this.provider === SsoOauthProvider.OPENID ? String(this.config?.userInfoUrl || '').trim() : this.provider.userInfoUrl;
  }

  private async exchange(code: string, redirectUri: string, verifier: string): Promise<any> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri,
      client_id: this.clientId, client_secret: this.clientSecret, code_verifier: verifier,
    });
    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(SsoOauthClient.TIMEOUT_MS),
    });
    const tokens: any = await response.json().catch(() => ({}));
    // GitHub answers a refused exchange with 200 and an `error` field.
    if (!response.ok || tokens?.error || !(tokens?.access_token || tokens?.id_token)) {
      throw new Error(`Code exchange refused: ${tokens?.error_description || tokens?.error || response.status}`);
    }
    return tokens;
  }

  private async getJson(url: string, accessToken: string): Promise<any> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'fromcode-sso' },
      signal: AbortSignal.timeout(SsoOauthClient.TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Provider profile request failed: ${response.status}`);
    return response.json();
  }

  private async userInfoIdentity(accessToken: string): Promise<SsoIdentity> {
    const info = await this.getJson(this.userInfoEndpoint, accessToken);
    return new SsoIdentity(
      String(info?.email || '').trim().toLowerCase(),
      info?.email_verified === true || info?.email_verified === 'true',
      String(info?.given_name || '').trim() || null,
      String(info?.family_name || '').trim() || null,
    );
  }

  /** GitHub's profile carries no verified address; its email list says which one is primary and verified. */
  private async githubIdentity(accessToken: string): Promise<SsoIdentity> {
    const [profile, emails] = await Promise.all([
      this.getJson(this.provider.userInfoUrl, accessToken),
      this.getJson(this.provider.emailsUrl, accessToken),
    ]);
    const primary = (Array.isArray(emails) ? emails : []).find((entry: any) => entry?.primary === true);
    const [firstName, ...rest] = String(profile?.name || '').trim().split(/\s+/).filter(Boolean);
    return new SsoIdentity(String(primary?.email || '').trim().toLowerCase(), primary?.verified === true, firstName || null, rest.join(' ') || null);
  }

  private idTokenIdentity(idToken: string): SsoIdentity {
    const claims: any = jwt.decode(idToken);
    if (!claims?.aud) throw new Error('The provider returned no id token');
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(this.clientId)) throw new Error('The id token was issued to a different application');
    if (!claims.exp || Number(claims.exp) * 1000 < Date.now()) throw new Error('The id token has expired');
    if (!this.issuerMatches(String(claims.iss || ''), String(claims.tid || ''))) throw new Error('The id token has an unexpected issuer');

    const [nameFirst, ...nameRest] = String(claims.name || '').trim().split(/\s+/).filter(Boolean);
    return new SsoIdentity(
      String(claims.email || '').trim().toLowerCase(),
      this.idTokenEmailVerified(claims),
      String(claims.given_name || nameFirst || '').trim() || null,
      String(claims.family_name || nameRest.join(' ') || '').trim() || null,
    );
  }

  private issuerMatches(issuer: string, tenantId: string): boolean {
    if (this.provider === SsoOauthProvider.MICROSOFT) return Boolean(tenantId) && issuer === `https://login.microsoftonline.com/${tenantId}/v2.0`;
    return issuer.replace(/\/+$/, '') === String(this.config?.issuer || '').trim().replace(/\/+$/, '');
  }

  private idTokenEmailVerified(claims: any): boolean {
    if (this.provider === SsoOauthProvider.MICROSOFT) {
      return claims.tid === SsoOauthProvider.MICROSOFT_CONSUMER_TENANT || claims.xms_edov === true || claims.xms_edov === 1 || claims.xms_edov === '1';
    }
    return claims.email_verified === true || claims.email_verified === 'true';
  }

  private static isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }
}
