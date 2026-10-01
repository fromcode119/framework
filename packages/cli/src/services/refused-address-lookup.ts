import dns from 'dns';
import type { LookupAddress, LookupOptions } from 'dns';

/**
 * Picks an app's address the way the gateway's retry needs: not the one that just refused a connection.
 *
 * During a rolling deploy an app's name resolves to both its containers, and a new frontend refuses
 * connections until it has rendered every site (`FrontendWarmup`). The gateway retries a refused GET on
 * a fresh connection — but resolving the name again picks either container at random, so a retry could
 * land on the same refusing one twice and the visitor got a 502. An address that refused is now passed
 * over for a few seconds while another one exists; with only one address it is still used.
 */
export class RefusedAddressLookup {
  /** Long enough to cover the retries of one request, short enough to try the address again soon. */
  static readonly AVOID_MS = 5_000;

  private readonly refusedUntil = new Map<string, number>();

  constructor(private readonly resolveAll: (hostname: string, family: number) => Promise<LookupAddress[]> = RefusedAddressLookup.dnsAll) {}

  /** Records the address a connection was refused at (from the error the proxy reports). */
  noteRefused(error: NodeJS.ErrnoException & { address?: string }, now: number = Date.now()): void {
    if (error?.code === 'ECONNREFUSED' && error.address) this.refusedUntil.set(error.address, now + RefusedAddressLookup.AVOID_MS);
  }

  /** The `lookup` an http.Agent takes: every address of the name, minus the ones refusing right now. */
  readonly lookup = (hostname: string, options: LookupOptions, callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void): void => {
    this.resolveAll(hostname, Number(options?.family) || 0).then((addresses) => {
      const usable = this.usable(addresses);
      if (options?.all) {
        callback(null, usable);
        return;
      }
      const chosen = usable[Math.floor(Math.random() * usable.length)];
      callback(null, chosen.address, chosen.family);
    }, (error) => callback(error, '', 0));
  };

  /** The addresses not refusing; all of them if every one is (better a retry than no connection). */
  usable(addresses: LookupAddress[], now: number = Date.now()): LookupAddress[] {
    const open = addresses.filter((entry) => (this.refusedUntil.get(entry.address) ?? 0) <= now);
    return open.length ? open : addresses;
  }

  private static dnsAll(hostname: string, family: number): Promise<LookupAddress[]> {
    return dns.promises.lookup(hostname, { all: true, family: family as 0 | 4 | 6 });
  }
}
