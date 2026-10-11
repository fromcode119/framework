/**
 * Who may reach one site at all (Settings → Security → Edge protection): countries refused, countries
 * always sent through the browser check, and addresses refused. `tenantId` null is the platform's own
 * entry — every site without its own, and the platform's own hosts.
 */
export class EdgeSiteRules {
  constructor(
    readonly tenantId: string | null,
    /** ISO country codes, upper case. */
    readonly blockedCountries: readonly string[],
    readonly challengedCountries: readonly string[],
    /** Addresses or CIDR blocks. */
    readonly blockedAddresses: readonly string[],
  ) {}

  get isEmpty(): boolean {
    return !this.blockedCountries.length && !this.challengedCountries.length && !this.blockedAddresses.length;
  }

  toJSON(): Record<string, unknown> {
    return {
      tenantId: this.tenantId,
      blockedCountries: [...this.blockedCountries],
      challengedCountries: [...this.challengedCountries],
      blockedAddresses: [...this.blockedAddresses],
    };
  }

  static fromJson(raw: unknown): EdgeSiteRules {
    const value = (raw ?? {}) as Record<string, unknown>;
    const list = (entry: unknown): string[] => (Array.isArray(entry) ? entry.map((item) => String(item)) : []);
    return new EdgeSiteRules(
      value.tenantId === null || value.tenantId === undefined ? null : String(value.tenantId),
      list(value.blockedCountries).map((code) => code.toUpperCase()),
      list(value.challengedCountries).map((code) => code.toUpperCase()),
      list(value.blockedAddresses),
    );
  }
}
