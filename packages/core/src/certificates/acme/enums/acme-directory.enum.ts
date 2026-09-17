import { Enum } from '@fromcode119/react-class-components';

/**
 * The certificate authorities an operator can pick from a list, and what they are called.
 *
 * The SETTING stores a URL, not a member of this enum — an operator may point at an authority
 * nobody here has heard of, and a fixed list would make that impossible. This exists so the two
 * everybody actually uses can be chosen without typing a URL, and so a stored URL can be shown by
 * name instead of as a raw string.
 *
 * STAGING IS OFFERED DELIBERATELY. It is the only way to exercise issuance end to end without
 * spending a production rate limit, and a certificate it issues is untrusted by browsers — so the
 * admin must show which authority a certificate came from rather than leaving somebody to wonder
 * why a valid-looking certificate produces a warning.
 */
export class AcmeDirectory extends Enum {
  static readonly LETSENCRYPT = new AcmeDirectory(
    'https://acme-v02.api.letsencrypt.org/directory',
    "Let's Encrypt",
    false,
  );

  static readonly LETSENCRYPT_STAGING = new AcmeDirectory(
    'https://acme-staging-v02.api.letsencrypt.org/directory',
    "Let's Encrypt (staging — certificates are NOT trusted by browsers)",
    true,
  );

  private constructor(value: string, readonly label: string, readonly isTestAuthority: boolean) {
    super(value);
  }

  /** The member for a stored URL, or null when it names one nobody listed here. */
  static find(value: unknown): AcmeDirectory | null {
    if (value instanceof AcmeDirectory) return value;
    return (AcmeDirectory.fromValue(String(value ?? '').trim()) as AcmeDirectory | undefined) ?? null;
  }

  /** What an operator may pick, plus whatever they typed. Shown in the settings card. */
  static options(): Array<{ value: string; label: string }> {
    return AcmeDirectory.values<AcmeDirectory>().map((member) => ({ value: String(member.value), label: member.label }));
  }

  /** How to describe a stored directory URL — its name when known, the URL itself when not. */
  static describe(url: unknown): string {
    const raw = String(url ?? '').trim();
    if (!raw) return '';
    return AcmeDirectory.find(raw)?.label ?? raw;
  }
}
