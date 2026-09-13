import { CertificateBundleEntry } from '@core/certificates/certificate-bundle-entry';

/**
 * Every certificate the platform holds, keyed by the exact host it serves — the shape whatever
 * terminates TLS keeps in memory and answers handshakes from.
 *
 * EXACT HOSTS ONLY, no suffix or wildcard matching, exactly as `HostPermission` refuses them. A
 * certificate that covers `*.example.com` is stored against each host that uses it, so a lookup
 * never has to guess which row a name belongs to and removing one host cannot leave another
 * silently armed.
 */
export class CertificateBundle {
  private constructor(private readonly byHost: Map<string, CertificateBundleEntry>) {}

  /** An empty bundle — what a terminator holds before its first successful fetch. */
  static empty(): CertificateBundle {
    return new CertificateBundle(new Map());
  }

  /**
   * Hydrate from the internal endpoint's response.
   *
   * Entries that carry no usable material are dropped rather than stored as blanks: a terminator
   * must be able to tell "no certificate for this host" from "a broken one", and an empty string
   * passed to `createSecureContext` throws at handshake time instead.
   */
  static fromJson(raw: unknown): CertificateBundle {
    const bag = raw as Record<string, unknown> | undefined;
    const list = Array.isArray(bag?.certificates) ? bag.certificates : [];
    const byHost = new Map<string, CertificateBundleEntry>();
    for (const item of list) {
      const entry = CertificateBundleEntry.from(item);
      if (entry) byHost.set(entry.host, entry);
    }
    return new CertificateBundle(byHost);
  }

  /** The entry for an exact host, or undefined. The host is normalised the way the store keys it. */
  find(host: string): CertificateBundleEntry | undefined {
    return this.byHost.get(String(host || '').trim().toLowerCase().replace(/\.$/, '').replace(/:\d+$/, ''));
  }

  get size(): number {
    return this.byHost.size;
  }

  /** The hosts held, for a terminator that wants to say what it is serving. */
  hosts(): string[] {
    return [...this.byHost.keys()];
  }
}
