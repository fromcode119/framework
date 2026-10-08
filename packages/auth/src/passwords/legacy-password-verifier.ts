import { createHash, createHmac, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PhpassHash } from '@auth/passwords/phpass-hash';

/**
 * Verifies password hashes written by the platforms a site migrates FROM, so their users can sign in
 * with the password they already have. A successful check is followed by a rehash to the framework's
 * own bcrypt (see `needsRehash`), so each legacy hash is used once and then disappears.
 *
 * WHY THIS IS IN THE KERNEL AND NOT A PLUGIN HOOK: a verifier decides whether a login succeeds. A
 * plugin able to register one could register `() => true` and own every account on the site. The set
 * below is fixed, audited and pure — hash algorithms, not platform logic — and an importer only has
 * to STORE the hash in one of these shapes.
 *
 * Recognised as stored by their platform:
 *  - `$P$…` / `$H$…`   phpass MD5 — WordPress before 6.8, phpBB, older Joomla
 *  - `$S$…`            phpass SHA-512 — Drupal 7 to 10.0; `U$S$…` is Drupal's MD5-prehashed form
 *  - `$wp$2y$…`        WordPress 6.8+: bcrypt over base64(HMAC-SHA384(password, "wp-sha384"))
 * (Plain `$2y$`/`$2a$`/`$2b$` bcrypt — PrestaShop 1.7+, Joomla 3+, Drupal 10.1+, Ghost — needs no
 * help: the framework's own bcrypt verifies it.)
 *
 * Salted digests have no self-describing form, so an importer writes them as
 *   `$legacy$<scheme>$<salt as hex>$<digest as hex>`
 * with scheme one of:
 *  - `md5-prefix`     md5(salt + password)  — Magento 1, PrestaShop 1.6 (salt = _COOKIE_KEY_), bare md5 (empty salt)
 *  - `md5-suffix`     md5(password + salt)  — Joomla 1.5–2.5 `hash:salt`
 *  - `sha256-prefix`  sha256(salt + password) — Magento 2 `hash:salt:1`
 *  - `opencart-sha1`  sha1(salt + sha1(salt + sha1(password))) — OpenCart 1.5–3
 */
export class LegacyPasswordVerifier {
  private static readonly PREFIX = '$legacy$';
  private static readonly WORDPRESS_BCRYPT = '$wp$2';
  private static readonly ENCODED = /^\$legacy\$([a-z0-9-]+)\$((?:[0-9a-f]{2})*)\$([0-9a-f]+)$/;

  /** Each salted scheme: the digest of (salt, password), as hex. */
  private static readonly SALTED: Record<string, (salt: Buffer, password: Buffer) => string> = {
    'md5-prefix': (salt, password) => LegacyPasswordVerifier.hex('md5', Buffer.concat([salt, password])),
    'md5-suffix': (salt, password) => LegacyPasswordVerifier.hex('md5', Buffer.concat([password, salt])),
    'sha256-prefix': (salt, password) => LegacyPasswordVerifier.hex('sha256', Buffer.concat([salt, password])),
    'opencart-sha1': (salt, password) => {
      const inner = LegacyPasswordVerifier.hex('sha1', password);
      const middle = LegacyPasswordVerifier.hex('sha1', Buffer.concat([salt, Buffer.from(inner)]));
      return LegacyPasswordVerifier.hex('sha1', Buffer.concat([salt, Buffer.from(middle)]));
    },
  };

  /** Whether `stored` is one of the legacy forms above — and so must be replaced after a good login. */
  static handles(stored: string): boolean {
    const value = String(stored ?? '');
    return value.startsWith(LegacyPasswordVerifier.PREFIX)
      || value.startsWith(LegacyPasswordVerifier.WORDPRESS_BCRYPT)
      || /^U?\$S\$/.test(value)
      || /^\$[PH]\$/.test(value);
  }

  /** Whether `password` matches `stored`. False for a malformed or unknown form, never a throw. */
  static async verify(password: string, stored: string): Promise<boolean> {
    const value = String(stored ?? '');
    const secret = String(password ?? '');

    if (value.startsWith(LegacyPasswordVerifier.WORDPRESS_BCRYPT)) {
      const prehashed = createHmac('sha384', 'wp-sha384').update(secret, 'utf8').digest('base64');
      return bcrypt.compare(prehashed, value.slice(3)).catch(() => false);
    }
    if (value.startsWith('U$S$')) {
      return LegacyPasswordVerifier.same(PhpassHash.compute(LegacyPasswordVerifier.hex('md5', Buffer.from(secret, 'utf8')), value.slice(1)), value.slice(1));
    }
    if (/^\$[PHS]\$/.test(value)) {
      return LegacyPasswordVerifier.same(PhpassHash.compute(secret, value), value);
    }

    const encoded = LegacyPasswordVerifier.ENCODED.exec(value);
    const scheme = encoded ? LegacyPasswordVerifier.SALTED[encoded[1]] : undefined;
    if (!encoded || !scheme) return false;
    const digest = scheme(Buffer.from(encoded[2], 'hex'), Buffer.from(secret, 'utf8'));
    return LegacyPasswordVerifier.same(digest, encoded[3]);
  }

  private static hex(algorithm: string, input: Buffer): string {
    return createHash(algorithm).update(input).digest('hex');
  }

  /** Constant-time equality; unequal lengths (or a hash that could not be computed) are a mismatch. */
  private static same(computed: string | null, expected: string): boolean {
    if (computed === null) return false;
    const a = Buffer.from(computed);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
