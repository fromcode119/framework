/**
 * What a host's DNS actually says, next to what this platform declared it should say.
 *
 * Carries BOTH sides because the operator's next action depends on the difference, not on a verdict.
 * "Not pointing here" sends somebody to check a registrar; "points at 1.2.3.4, expected 5.6.7.8"
 * tells them it points at the OLD host, which is a different afternoon entirely.
 */
export class DnsPreflightResult {
  private constructor(
    readonly host: string,
    readonly observedIpv4: readonly string[],
    readonly observedIpv6: readonly string[],
    readonly expected: readonly string[],
    readonly isPointingHere: boolean,
    readonly reason: string,
  ) {}

  static pointingHere(host: string, ipv4: string[], ipv6: string[], expected: string[]): DnsPreflightResult {
    return new DnsPreflightResult(host, ipv4, ipv6, expected, true, '');
  }

  static notPointingHere(host: string, ipv4: string[], ipv6: string[], expected: string[], reason: string): DnsPreflightResult {
    return new DnsPreflightResult(host, ipv4, ipv6, expected, false, reason);
  }

  /** Every address seen, both families, for display. */
  get observed(): string[] {
    return [...this.observedIpv4, ...this.observedIpv6];
  }

  /** One line an operator can act on, stored verbatim in `last_error`. */
  describe(): string {
    if (this.isPointingHere) return '';
    const seen = this.observed.length ? this.observed.join(', ') : 'nothing';
    return `${this.reason} — ${this.host} resolves to ${seen}; this platform is at ${this.expected.join(', ')}.`;
  }
}
