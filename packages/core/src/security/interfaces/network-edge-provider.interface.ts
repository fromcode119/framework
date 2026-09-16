/**
 * One network-edge / CDN vendor whose infrastructure may sit in front of this platform's reverse
 * proxy and rewrite the real visitor address into a header of its own.
 *
 * Cloudflare is the only implementation today, but it must not be the only one this shape supports:
 * a different vendor uses a different header for the same purpose (Fastly's `Fastly-Client-IP`,
 * CloudFront's own scheme), so the header lives on the provider, never hardcoded in the resolver
 * that walks them.
 */
export interface INetworkEdgeProvider {
  /** Stable identifier — used as the per-provider settings/env key suffix, e.g. 'cloudflare'. */
  readonly key: string;
  /** The header (lowercase) this provider's edge sets with the real visitor address. */
  readonly trustedIpHeader: string;
  /** This provider's published edge ranges — the seed for its operator-editable settings row. */
  readonly defaultRanges: ReadonlyArray<readonly [string, number]>;
}
