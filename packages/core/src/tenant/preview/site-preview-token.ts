import { createHash, randomBytes } from 'crypto';

/**
 * The secrets a site preview is carried by, and the one-way function they are stored under.
 *
 * Separated from the store because it is the half that must be got right in exactly one place. The
 * store never invents a token and never hashes one its own way; a second implementation of either is
 * how a "random" value ends up predictable or a hash ends up reversible.
 *
 * 256 bits of `randomBytes`, base64url so it survives a URL path segment untouched. SHA-256 is the
 * right function HERE and would be wrong for a password: these are full-entropy random values, not
 * something guessable, so there is nothing for a slow hash to defend against — and the session hash
 * is looked up on every request a preview makes.
 */
export class SitePreviewToken {
  private static readonly BYTES = 32;

  /** A fresh secret. Returned to the caller ONCE; only its hash is ever stored. */
  static mint(): string {
    return randomBytes(SitePreviewToken.BYTES).toString('base64url');
  }

  /** What goes in the table. An empty or absent value hashes to '' rather than to a real digest. */
  static hash(token: unknown): string {
    const value = String(token ?? '').trim();
    if (!value) return '';
    return createHash('sha256').update(value).digest('hex');
  }
}
