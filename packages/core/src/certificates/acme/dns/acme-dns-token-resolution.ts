import { AcmeTokenScope } from '@core/certificates/acme/enums/acme-token-scope.enum';
import { SecretService } from '@core/security/secret-service';

/**
 * Which token a host's DNS-01 order will use, and where it came from.
 *
 * Carries the ciphertext rather than the plaintext so that merely ASKING the question — which the
 * admin does on every Certificates page load — never decrypts anything. {@link token} is the one
 * accessor that does, and it throws when `SECRET_KEY` has been rotated since the token was saved;
 * every caller of it must be inside a try/catch that records the failure against the host, or the
 * throw escapes the sweep and leaves the host perpetually due with nothing shown in the admin.
 */
export class AcmeDnsTokenResolution {
  constructor(readonly scope: AcmeTokenScope, private readonly ciphertext: string) {}

  /** Nothing stored on either scope. DNS-01 cannot proceed for this host. */
  static none(): AcmeDnsTokenResolution {
    return new AcmeDnsTokenResolution(AcmeTokenScope.NONE, '');
  }

  /** Whether a token exists at all. NEVER decrypts — presence of ciphertext is all this answers. */
  get isConfigured(): boolean {
    return this.ciphertext.length > 0;
  }

  /** Whether the host is falling back to the platform's token rather than its owner's. */
  get isPlatformFallback(): boolean {
    return this.scope === AcmeTokenScope.PLATFORM;
  }

  /** The decrypted token. Throws when the ciphertext can no longer be read. */
  get token(): string {
    return this.ciphertext ? SecretService.decrypt(this.ciphertext) : '';
  }

  /**
   * How to name this token in a failure the operator has to act on.
   *
   * A zone error is the one place where knowing WHICH credential was tried is the whole fix: the
   * same "cannot see zone" sentence means "widen your token" for a site's own, and "this site needs
   * its own token" for the platform fallback.
   */
  get description(): string {
    if (this.scope === AcmeTokenScope.SITE) return "this site's own Cloudflare token";
    if (this.scope === AcmeTokenScope.PLATFORM) return "the platform's Cloudflare token";
    return 'no Cloudflare token';
  }
}
