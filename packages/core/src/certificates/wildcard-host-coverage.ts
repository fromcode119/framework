/**
 * Which host a wildcard certificate answers for — the ONE place that rule lives.
 *
 * Two layers ask it and they must never disagree. The gateway asks at handshake time, to decide
 * which stored certificate to serve for an SNI name. The admin asks while rendering, to decide
 * whether a host with no certificate of its own is nevertheless covered by one.
 *
 * When those two answered differently the screen lied in the more dangerous direction: it told the
 * operator a host "cannot be served over HTTPS by this platform" while the gateway was serving it
 * perfectly well from a wildcard — an invitation to order a second certificate for a name that
 * already had one, and to distrust a screen that was wrong.
 *
 * The rule is X.509's, not ours: `*.example.com` matches ONE label below `example.com`.
 */
export class WildcardHostCoverage {
  /** Lower-cased, trailing dot and port removed — the shape the store keys hosts by. */
  static normalize(host: string): string {
    return String(host || '').trim().toLowerCase().replace(/\.$/, '').replace(/:\d+$/, '');
  }

  /**
   * The host one label up, or '' when there is none worth trying.
   *
   * A parent must still be a real domain. Without that check `a.com` would look up `com`, and a
   * wildcard row for a public suffix could answer for everything beneath it.
   */
  static parentOf(host: string): string {
    const normalized = WildcardHostCoverage.normalize(host);
    const dot = normalized.indexOf('.');
    if (dot < 0) return '';
    const parent = normalized.slice(dot + 1);
    return parent.includes('.') ? parent : '';
  }

  /**
   * Whether a WILDCARD certificate stored against `certificateHost` covers `host`.
   *
   * The caller is responsible for knowing the certificate is a wildcard at all; this answers only
   * the name question. Exactness is not covered here — an exact match is a different thing and
   * always takes precedence, which is the caller's business too.
   */
  static covers(certificateHost: string, host: string): boolean {
    const parent = WildcardHostCoverage.parentOf(host);
    return parent.length > 0 && parent === WildcardHostCoverage.normalize(certificateHost);
  }
}
