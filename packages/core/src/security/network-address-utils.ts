import { CoercionUtils } from '@core/utils/coercion-utils';
import { BlockList, isIP } from 'net';
import type { INetworkEdgeProvider } from '@core/security/interfaces/network-edge-provider.interface';
import { NetworkEdgeProviderRegistry } from '@core/security/providers/network-edge-provider-registry';

/**
 * Address matching for the network allowlists the platform declares.
 *
 * The same question — "did this request come from our own network?" — is asked by the API's
 * `trust proxy` predicate and by the rate limiter's internal-service bucket. It was a hand-rolled
 * regex in the first, and would have become a second copy in the other; both belong here so a range
 * added once applies everywhere.
 *
 * A pattern is either an exact address (`10.0.0.5`, `::1`) or an IPv4 CIDR block (`172.16.0.0/12`).
 * IPv6 addresses match literally; the IPv4-mapped form Node reports on a dual-stack socket
 * (`::ffff:10.0.0.5`) is unwrapped first so an IPv4 rule still matches it.
 */
export class NetworkAddressUtils {
  private static readonly NON_PUBLIC_ADDRESSES = NetworkAddressUtils.buildNonPublicBlockList();
  /**
   * Loopback plus the RFC1918 private ranges — the addresses a container network hands out. This is
   * the seed for the operator's declared internal-clients setting, not a hidden default: the value is
   * written into `_system_meta` where it can be read and narrowed.
   */
  static readonly PRIVATE_RANGES = [
    '127.0.0.0/8',
    '::1',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
  ] as const;

  /** The private ranges as the comma-separated text an operator edits in admin. */
  static get PRIVATE_RANGES_TEXT(): string {
    return NetworkAddressUtils.PRIVATE_RANGES.join(', ');
  }

  /**
   * Each registered edge provider's own block list, built once and cached by provider key — the
   * provider-driven replacement for a single hardcoded Cloudflare list. See
   * `NetworkEdgeProviderRegistry` for how a second provider gets added here without touching any of
   * the methods below.
   */
  private static readonly EDGE_PROVIDER_BLOCK_LISTS = new Map<string, BlockList>();

  /** Strip the IPv6 brackets, the IPv4-mapped prefix and any `:port` suffix Node may attach. */
  static normalize(value: unknown): string {
    let address = CoercionUtils.toKey(value);
    if (!address) return '';

    const closingBracket = address.indexOf(']');
    if (address.startsWith('[') && closingBracket > 0) {
      address = address.slice(1, closingBracket);
    }

    if (address.startsWith('::ffff:')) {
      address = address.slice('::ffff:'.length);
    }

    // A bare IPv6 address has several colons and no dots, so only a dotted host:port pair is split.
    if (address.includes('.') && address.includes(':')) {
      address = address.split(':')[0] || '';
    }

    return address;
  }

  /** True when `address` is the exact address `pattern`, or falls inside its IPv4 CIDR block. */
  static matches(address: unknown, pattern: unknown): boolean {
    const normalizedAddress = NetworkAddressUtils.normalize(address);
    const rawPattern = CoercionUtils.toKey(pattern);
    if (!normalizedAddress || !rawPattern) return false;

    const separatorIndex = rawPattern.indexOf('/');
    if (separatorIndex < 0) {
      return NetworkAddressUtils.normalize(rawPattern) === normalizedAddress;
    }

    const prefixBits = Number(rawPattern.slice(separatorIndex + 1));
    if (!Number.isInteger(prefixBits) || prefixBits < 0 || prefixBits > 32) return false;

    const addressNumber = NetworkAddressUtils.toIpv4Number(normalizedAddress);
    const blockNumber = NetworkAddressUtils.toIpv4Number(NetworkAddressUtils.normalize(rawPattern.slice(0, separatorIndex)));
    if (addressNumber === null || blockNumber === null) return false;
    if (prefixBits === 0) return true;

    const mask = prefixBits === 32 ? 0xFFFFFFFF : (~((2 ** (32 - prefixBits)) - 1)) >>> 0;
    return ((addressNumber & mask) >>> 0) === ((blockNumber & mask) >>> 0);
  }

  /** True when `address` matches any pattern in the list. An empty list matches nothing. */
  static matchesAny(address: unknown, patterns: readonly unknown[] | undefined): boolean {
    if (!Array.isArray(patterns) || patterns.length === 0) return false;
    return patterns.some((pattern) => NetworkAddressUtils.matches(address, pattern));
  }

  /** True when the address is loopback or in an RFC1918 range. */
  static isPrivate(address: unknown): boolean {
    return NetworkAddressUtils.matchesAny(address, NetworkAddressUtils.PRIVATE_RANGES);
  }

  /** True only for a syntactically valid, globally routable IP address. */
  static isPublic(address: unknown): boolean {
    const normalized = NetworkAddressUtils.normalize(address);
    const family = isIP(normalized);
    if (!family) return false;
    return !NetworkAddressUtils.NON_PUBLIC_ADDRESSES.check(normalized, family === 4 ? 'ipv4' : 'ipv6');
  }

  /**
   * The registered edge provider whose published (plus operator-declared) ranges contain `address`,
   * or `null` when it matches none of them. `extraRangesByProvider` is keyed by each provider's
   * `key` — e.g. `{ cloudflare: [...] }` — the operator-declared addition to that provider's own
   * hardcoded default ranges.
   */
  static matchEdgeProvider(
    address: unknown,
    extraRangesByProvider?: Readonly<Record<string, readonly string[]>>,
  ): INetworkEdgeProvider | null {
    const normalized = NetworkAddressUtils.normalize(address);
    const family = isIP(normalized);
    if (!family) return null;

    for (const provider of NetworkEdgeProviderRegistry.ALL) {
      const blockList = NetworkAddressUtils.edgeBlockListFor(provider);
      if (blockList.check(normalized, family === 4 ? 'ipv4' : 'ipv6')) return provider;
      if (NetworkAddressUtils.matchesAny(normalized, extraRangesByProvider?.[provider.key])) return provider;
    }
    return null;
  }

  /**
   * The real visitor address for a request that may have transited a known edge provider (Cloudflare
   * today; any provider registered in `NetworkEdgeProviderRegistry`) in front of our own reverse
   * proxy.
   *
   * `req.ip` is already what Express's `trust proxy` walk (see `packages/api/src/index.ts`) resolved —
   * for a request that genuinely came through an edge provider, that walk trusts the private hop to
   * Traefik and then stops at the next entry, which is the provider's OWN edge address (public, so
   * untrusted by the RFC1918-only predicate). When that stopping point matches a registered
   * provider's own ranges, THAT provider's `trustedIpHeader` names the real visitor — the provider's
   * edge sets that header itself, overwriting anything the client sent, so it can only be trusted
   * when the chain already proves the request transited that provider's network, and only when the
   * header actually holds a syntactically valid IP (a malformed value falls through exactly like no
   * header at all, never returned verbatim). Any other case — a host not behind a known provider, or
   * a direct connection to the origin forging the header to bypass the edge entirely — falls back to
   * `req.ip` exactly as it resolved before this method existed, so neither case is a regression and
   * neither trusts a forged header.
   *
   * `extraRangesByProvider` is the operator-declared addition to each provider's hardcoded edge list
   * (see `RateLimitSettingsUtils.resolveNetworkEdgeRanges`) — optional, and omitted callers behave
   * exactly as before this parameter existed.
   */
  static resolveClientIp(
    req: { ip?: unknown; headers?: Record<string, unknown> } | null | undefined,
    extraRangesByProvider?: Readonly<Record<string, readonly string[]>>,
  ): string {
    const resolvedIp = NetworkAddressUtils.normalize(req?.ip);
    if (!resolvedIp) return resolvedIp;

    const provider = NetworkAddressUtils.matchEdgeProvider(resolvedIp, extraRangesByProvider);
    if (provider) {
      const headerValue = NetworkAddressUtils.normalize(req?.headers?.[provider.trustedIpHeader]);
      if (headerValue && isIP(headerValue)) return headerValue;
    }
    return resolvedIp;
  }

  /** Split an operator-entered list (commas, whitespace or newlines) into patterns. */
  static parseList(value: unknown): string[] {
    return CoercionUtils.toString(value)
      .split(/[\s,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private static toIpv4Number(address: string): number | null {
    const octets = address.split('.');
    if (octets.length !== 4) return null;

    let value = 0;
    for (const octet of octets) {
      if (!/^\d{1,3}$/.test(octet)) return null;
      const parsed = Number(octet);
      if (parsed > 255) return null;
      value = (value * 256) + parsed;
    }
    return value;
  }

  private static buildNonPublicBlockList(): BlockList {
    const list = new BlockList();
    for (const [address, prefix] of [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
      ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
    ] as Array<[string, number]>) {
      list.addSubnet(address, prefix, 'ipv4');
    }
    for (const [address, prefix] of [
      ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
    ] as Array<[string, number]>) {
      list.addSubnet(address, prefix, 'ipv6');
    }
    return list;
  }

  /** Built once per provider key and cached — every provider's ranges are fixed for the process. */
  private static edgeBlockListFor(provider: INetworkEdgeProvider): BlockList {
    let list = NetworkAddressUtils.EDGE_PROVIDER_BLOCK_LISTS.get(provider.key);
    if (list) return list;

    list = new BlockList();
    for (const [address, prefix] of provider.defaultRanges) {
      list.addSubnet(address, prefix, address.includes(':') ? 'ipv6' : 'ipv4');
    }
    NetworkAddressUtils.EDGE_PROVIDER_BLOCK_LISTS.set(provider.key, list);
    return list;
  }
}
