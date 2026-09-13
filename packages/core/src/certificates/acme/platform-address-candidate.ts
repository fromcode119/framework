/**
 * One of this platform's own hostnames and what it currently resolves to.
 *
 * A SUGGESTION, never a setting. It carries the hostname as well as the addresses because that is
 * the provenance: the operator can see the answer came from a name they themselves configured, and
 * can tell at a glance whether it is the machine they expect or something in front of it.
 */
export class PlatformAddressCandidate {
  constructor(
    readonly host: string,
    readonly ipv4: readonly string[],
    readonly ipv6: readonly string[],
  ) {}

  get hasAnswer(): boolean {
    return this.ipv4.length > 0 || this.ipv6.length > 0;
  }

  toJson(): Record<string, unknown> {
    return { host: this.host, ipv4: [...this.ipv4], ipv6: [...this.ipv6] };
  }
}
