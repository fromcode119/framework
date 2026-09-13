import { Resolver } from 'dns/promises';
import { DnsPreflightResult } from '@core/certificates/acme/dns-preflight-result';

/**
 * Does this host actually point at us — asked BEFORE a certificate is ever ordered.
 *
 * THIS IS THE RATE LIMIT GUARD. A certificate authority refuses a hostname after five failed
 * validations in an hour, and a domain whose DNS has not been pointed yet fails EVERY time. Ordering
 * first and finding out afterwards is how a platform locks itself out of a customer's domain for an
 * hour at a time, so nothing here is ever ordered on hope.
 *
 * A STRAY AAAA BLOCKS, and that is the subtle one. Certificate authorities prefer IPv6 when a AAAA
 * record exists: a host with a correct A record and a leftover AAAA pointing at an old server
 * validates against the OLD server and fails, while every check an operator runs from a v4-only
 * machine says the DNS is perfect. So every observed address must be one this platform declared,
 * not merely one of them.
 */
export class DnsPreflight {
  /** Resolution must not hang a sweep that has other hosts to get to. */
  private static readonly TIMEOUT_MS = 5000;

  /**
   * @param resolver anything exposing `resolve4`/`resolve6`; injected so the rules can be tested
   *                 without the network deciding the outcome.
   */
  constructor(private readonly resolver: { resolve4(host: string): Promise<string[]>; resolve6(host: string): Promise<string[]> }) {}

  /** The live resolver, with a timeout so one unresponsive domain cannot stall the sweep. */
  static system(): DnsPreflight {
    const resolver = new Resolver({ timeout: DnsPreflight.TIMEOUT_MS, tries: 2 });
    return new DnsPreflight(resolver);
  }

  /**
   * Whether `host` resolves to the declared platform addresses, and nowhere else.
   *
   * With no declared address this returns "not pointing here" rather than guessing — a platform that
   * has not been told its own address cannot judge anybody's DNS, and inventing one here would send
   * every customer to a machine nobody chose.
   */
  async check(host: string, expected: readonly string[]): Promise<DnsPreflightResult> {
    const wanted = expected.map((address) => DnsPreflight.normalize(address)).filter(Boolean);
    if (!wanted.length) {
      return DnsPreflightResult.notPointingHere(host, [], [], [], 'No platform address is declared');
    }

    const ipv4 = await this.resolve('resolve4', host);
    const ipv6 = await this.resolve('resolve6', host);
    const observed = [...ipv4, ...ipv6];

    if (!observed.length) {
      return DnsPreflightResult.notPointingHere(host, ipv4, ipv6, [...wanted], 'Does not resolve yet');
    }

    const strays = observed.filter((address) => !wanted.includes(DnsPreflight.normalize(address)));
    if (strays.length) {
      return DnsPreflightResult.notPointingHere(
        host, ipv4, ipv6, [...wanted],
        `Points somewhere else (${strays.join(', ')})`,
      );
    }

    return DnsPreflightResult.pointingHere(host, ipv4, ipv6, [...wanted]);
  }

  /** One family. A name with no record of that type is an empty answer, never an error. */
  private async resolve(method: 'resolve4' | 'resolve6', host: string): Promise<string[]> {
    try {
      const answers = await this.resolver[method](host);
      return (Array.isArray(answers) ? answers : []).map((address) => String(address));
    } catch {
      // ENOTFOUND / ENODATA are the ordinary answers for "no record of this type", not failures.
      return [];
    }
  }

  /** Lowercased and trimmed, so an IPv6 address written in two cases is not two addresses. */
  private static normalize(address: unknown): string {
    return String(address ?? '').trim().toLowerCase();
  }
}
