import type { INetworkEdgeProvider } from '@core/security/interfaces/network-edge-provider.interface';

/**
 * Cloudflare's published edge IP ranges (https://www.cloudflare.com/ips/) — the addresses
 * Cloudflare's own edge servers connect FROM. A hop landing here is not something a remote attacker
 * can forge: TCP requires completing the handshake from the address it claims, so a request that
 * reaches our reverse proxy from one of these ranges really did transit Cloudflare's network, the
 * same way a private-range hop proves a request came from inside our own container network.
 *
 * This is the network-edge concern's own security/providers folder, NOT
 * `certificates/acme/providers/cloudflare` — that one issues DNS-01 challenges; this one is about
 * which reverse-proxy hops we trust to name the real visitor. Different concern, different token,
 * deliberately not shared.
 */
export class CloudflareEdgeProvider implements INetworkEdgeProvider {
  static readonly KEY = 'cloudflare';

  readonly key = CloudflareEdgeProvider.KEY;
  readonly trustedIpHeader = 'cf-connecting-ip';
  /** This provider's ranges lived under this key before the generic, per-provider settings shape existed. */
  readonly legacyRangesKey = 'rate_limit_cloudflare_edge_ranges';

  readonly defaultRanges: ReadonlyArray<readonly [string, number]> = [
    ['173.245.48.0', 20], ['103.21.244.0', 22], ['103.22.200.0', 22], ['103.31.4.0', 22],
    ['141.101.64.0', 18], ['108.162.192.0', 18], ['190.93.240.0', 20], ['188.114.96.0', 20],
    ['197.234.240.0', 22], ['198.41.128.0', 17], ['162.158.0.0', 15], ['104.16.0.0', 13],
    ['104.24.0.0', 14], ['172.64.0.0', 13], ['131.0.72.0', 22],
    ['2400:cb00::', 32], ['2606:4700::', 32], ['2803:f800::', 32], ['2405:b500::', 32],
    ['2405:8100::', 32], ['2a06:98c0::', 29], ['2c0f:f248::', 32],
  ];
}
