import { SigningSecretService } from '@core/security/signing-secret-service';

/**
 * HMAC capability token for the GLOBAL email preferences page, signed over the recipient's ADDRESS.
 *
 * Every mailing plugin already mints a token for its own stream, and that is precisely why a page
 * listing EVERY declared stream cannot use one: it would have to know which plugin issued the link and
 * ask that plugin to verify it — the cross-plugin coupling the architecture forbids. The suppression
 * list and the category registry are framework-owned, so the token that governs them is too.
 *
 * Signed over the address rather than a user id for two reasons: most recipients have no account at
 * all, and an id in a link is a sequential integer anyone could enumerate to change a stranger's mail
 * settings. The address is also the only thing the suppression list is keyed by.
 *
 * The key is derived from the install's root secret for THIS purpose alone, so a preferences link can
 * never be replayed as a review-request or campaign-unsubscribe link, nor the reverse. There is no
 * default key: an empty one throws on generate and rejects on verify.
 */
export class EmailPreferencesTokenService {
  /** Purpose label for key derivation — scopes this key to the preferences page only. */
  static readonly PURPOSE = 'system.email-preferences';

  private static encode(address: string): string {
    return Buffer.from(JSON.stringify({ address: String(address).toLowerCase().trim() })).toString('base64url');
  }

  /** @throws when `secret` is empty — a preferences link must never go out unsigned. */
  static generate(address: string, secret: string): string {
    const encoded = EmailPreferencesTokenService.encode(address);
    return `${encoded}.${SigningSecretService.sign(secret, encoded)}`;
  }

  /**
   * The address this token was minted for, or `null` for anything that does not verify.
   *
   * Never throws: a missing key, a malformed token and a bad signature all mean reject, so a caller
   * cannot accidentally treat "could not check" as "checked out fine".
   */
  static resolveAddress(token: string, secret: string): string | null {
    if (!token || !secret) return null;
    const parts = String(token).split('.');
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;
    if (!SigningSecretService.verify(secret, encoded, String(signature ?? ''))) return null;

    try {
      const address = String(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))?.address ?? '').trim();
      return address || null;
    } catch {
      return null;
    }
  }
}
