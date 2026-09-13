import { Resolver } from 'dns/promises';
import { PlatformAddressCandidate } from '@core/certificates/acme/platform-address-candidate';

/**
 * What this platform's own hostnames resolve to — offered to the operator, never stored on their
 * behalf.
 *
 * WHY THIS IS NOT AN INVENTED VALUE. It resolves the hostnames the operator ALREADY configured for
 * the admin, api and storefront. That is reading back their own declaration, not manufacturing a
 * fact: the platform is not deciding where it lives, it is reporting where the names it was given
 * currently point.
 *
 * IT IS STILL ONLY A SUGGESTION, because the answer can be right-looking and wrong. If those
 * hostnames sit behind a proxy or CDN, they resolve to the proxy — and storing that would make the
 * platform hand every customer a DNS instruction pointing at an edge that has never heard of them,
 * and judge every domain against an address that is not this machine. No detection can tell those
 * cases apart, so a person accepts it or does not.
 *
 * Uses the same resolver shape as the pre-flight, so what is suggested and what is later checked
 * cannot disagree.
 */
export class PlatformAddressDetection {
  private static readonly TIMEOUT_MS = 5000;

  constructor(private readonly resolver: { resolve4(host: string): Promise<string[]>; resolve6(host: string): Promise<string[]> }) {}

  static system(): PlatformAddressDetection {
    return new PlatformAddressDetection(new Resolver({ timeout: PlatformAddressDetection.TIMEOUT_MS, tries: 2 }));
  }

  /** One candidate per hostname that answers. Names that resolve to nothing are left out. */
  async detect(hosts: readonly string[]): Promise<PlatformAddressCandidate[]> {
    const candidates: PlatformAddressCandidate[] = [];
    for (const host of hosts) {
      const name = String(host || '').trim().toLowerCase();
      if (!name) continue;
      const candidate = new PlatformAddressCandidate(name, await this.resolve('resolve4', name), await this.resolve('resolve6', name));
      if (candidate.hasAnswer) candidates.push(candidate);
    }
    return candidates;
  }

  private async resolve(method: 'resolve4' | 'resolve6', host: string): Promise<string[]> {
    try {
      const answers = await this.resolver[method](host);
      return (Array.isArray(answers) ? answers : []).map((address) => String(address));
    } catch {
      return [];
    }
  }
}
