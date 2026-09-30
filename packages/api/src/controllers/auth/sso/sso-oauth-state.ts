import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * One redirect sign-in in flight, carried in a cookie between `start` and `callback`.
 *
 * `state` defeats login CSRF (a callback this browser did not start is refused) and `verifier` is the
 * PKCE secret the code exchange must present, so an intercepted code is useless on its own. The paths
 * say where the visitor goes afterwards, and `redirectUri` is the exact callback address sent to the
 * provider: the exchange must repeat it byte for byte, and the callback request (arriving from the
 * provider, with no storefront referer) cannot be trusted to work the same address out again. The cookie is sealed by a signed grant whose scope is a hash
 * of every field plus the provider and site, so none of it can be edited or replayed on another site.
 */
export class SsoOauthState {
  static readonly PURPOSE = 'sso-oauth';
  static readonly TTL_SECONDS = 10 * 60;

  constructor(
    readonly state: string,
    readonly verifier: string,
    readonly returnTo: string,
    readonly errorTo: string,
    readonly redirectUri: string,
  ) {}

  static begin(returnTo: string, errorTo: string, redirectUri: string): SsoOauthState {
    return new SsoOauthState(randomBytes(24).toString('base64url'), randomBytes(48).toString('base64url'), returnTo, errorTo, redirectUri);
  }

  /** The PKCE `code_challenge` (S256) sent to the provider. */
  get challenge(): string {
    return createHash('sha256').update(this.verifier).digest('base64url');
  }

  /** What the grant is scoped to: this exact state, for this provider, on this site. */
  scope(provider: string, tenantId: string | null): string {
    return createHash('sha256')
      .update([this.state, this.verifier, this.returnTo, this.errorTo, this.redirectUri, provider, tenantId ?? ''].join('\n'))
      .digest('base64url');
  }

  /** True when the `state` the provider echoed back is the one this browser started with. */
  matches(returned: string): boolean {
    const expected = Buffer.from(this.state);
    const actual = Buffer.from(String(returned || ''));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  serialize(grant: string): string {
    return Buffer.from(JSON.stringify({ s: this.state, v: this.verifier, r: this.returnTo, e: this.errorTo, u: this.redirectUri, g: grant })).toString('base64url');
  }

  /** The state and its grant from a cookie, or null when the cookie is absent or malformed. */
  static parse(raw: unknown): { state: SsoOauthState; grant: string } | null {
    try {
      const data = JSON.parse(Buffer.from(String(raw || ''), 'base64url').toString('utf8'));
      if (!data?.s || !data?.v || !data?.u || !data?.g) return null;
      return {
        state: new SsoOauthState(String(data.s), String(data.v), SsoOauthState.localPath(data.r), SsoOauthState.localPath(data.e), String(data.u)),
        grant: String(data.g),
      };
    } catch {
      return null;
    }
  }

  /**
   * A same-site path to send the visitor to, or '' when the value is anything else. `//host` and
   * `/\host` are protocol-relative URLs a browser follows off-site, so only a single leading slash counts.
   */
  static localPath(value: unknown): string {
    const path = String(value ?? '').trim();
    if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '';
    if (/[\u0000-\u001f]/.test(path)) return '';
    return path;
  }
}
