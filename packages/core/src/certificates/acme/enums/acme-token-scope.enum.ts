import { Enum } from '@fromcode119/react-class-components';

/**
 * Whose Cloudflare token a DNS-01 order is about to use.
 *
 * This exists because the answer has to be SHOWN, not just acted on. An operator looking at a site's
 * Certificates screen must be able to see whether that site is using its own credential or falling
 * back to the platform's — otherwise a token saved on the wrong scope looks identical to one saved
 * on the right one, right up until an order fails for a zone nobody can explain.
 */
export class AcmeTokenScope extends Enum {
  /** The site or workspace stores its own token. */
  static readonly SITE = new AcmeTokenScope('site');

  /** No token of its own; the platform's is being used. */
  static readonly PLATFORM = new AcmeTokenScope('platform');

  /** Neither scope has one, so DNS-01 is unavailable for this host. */
  static readonly NONE = new AcmeTokenScope('none');

  /** The member for a stored value, or null when it names one nobody listed here. */
  static find(value: unknown): AcmeTokenScope | null {
    if (value instanceof AcmeTokenScope) return value;
    return (AcmeTokenScope.fromValue(String(value ?? '').trim()) as AcmeTokenScope | undefined) ?? null;
  }
}
