import { CertificateBundleEntry } from '@core/certificates/certificate-bundle-entry';

/**
 * Every certificate the platform holds, keyed by the exact host it serves — the shape whatever
 * terminates TLS keeps in memory and answers handshakes from.
 *
 * EXACT HOSTS FIRST, and nothing is ever matched by suffix. The one exception is a certificate the
 * operator explicitly ordered as a WILDCARD: that one also answers for `*.<host>`, one label deep,
 * exactly as an X.509 wildcard does — `a.example.com` yes, `a.b.example.com` no.
 *
 * That exception exists because without it the wildcard was a control that did not do what it said.
 * The operator picks "Automatic (wildcard)", the order really does carry the `*.` SAN, and the
 * certificate then served only the bare name it was ordered for — every subdomain still needed its
 * own certificate. This file previously claimed such a certificate was "stored against each host
 * that uses it"; nothing ever did that, so the claim described an intent no code carried out.
 *
 * It is NOT a default certificate and does not weaken the no-default rule: a name is served only by
 * a certificate that genuinely covers it, only when the operator asked for a wildcard, and a name no
 * certificate covers is still refused at the handshake.
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

  /**
   * The entry serving this host, or undefined. The host is normalised the way the store keys it.
   *
   * An exact row always wins, so a host with its own certificate is never served by somebody's
   * wildcard. Only when there is no exact row does a wildcard parent answer, and only one label up.
   */
  find(host: string): CertificateBundleEntry | undefined {
    const normalized = CertificateBundle.normalize(host);
    if (!normalized) return undefined;

    const exact = this.byHost.get(normalized);
    if (exact) return exact;

    const parent = CertificateBundle.parentOf(normalized);
    if (!parent) return undefined;
    const covering = this.byHost.get(parent);
    return covering?.wildcard ? covering : undefined;
  }

  /** The host one label up, or '' when there is none worth trying. */
  private static parentOf(host: string): string {
    const dot = host.indexOf('.');
    if (dot < 0) return '';
    const parent = host.slice(dot + 1);
    // A parent must still be a real domain. Without this, `a.com` would look up `com` — and a
    // wildcard row for a public suffix must never be able to answer for anything under it.
    return parent.includes('.') ? parent : '';
  }

  private static normalize(host: string): string {
    return String(host || '').trim().toLowerCase().replace(/\.$/, '').replace(/:\d+$/, '');
  }

  get size(): number {
    return this.byHost.size;
  }

  /** The hosts held, for a terminator that wants to say what it is serving. */
  hosts(): string[] {
    return [...this.byHost.keys()];
  }
}
