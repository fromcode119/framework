import { CoercionUtils } from '@core/coercion-utils';

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

  /** Strip the IPv6 brackets, the IPv4-mapped prefix and any `:port` suffix Node may attach. */
  static normalize(value: unknown): string {
    let address = CoercionUtils.toString(value).trim().toLowerCase();
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
    const rawPattern = CoercionUtils.toString(pattern).trim().toLowerCase();
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
}
