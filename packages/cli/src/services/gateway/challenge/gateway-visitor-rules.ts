import http from 'http';
import net from 'net';
import { EdgeSiteRules, GeoIpLookup, NetworkAddressUtils } from '@fromcode119/core';

/**
 * Who may reach a site (Settings → Security → Edge protection): blocked addresses, blocked countries,
 * and countries always sent through the browser check. The country comes from the visitor's address
 * and the platform's geo database (the same one analytics uses); an address it cannot place — or no
 * database at all — is never refused for its country.
 */
export class GatewayVisitorRules {
  static readonly REFUSE = 'refuse';
  /** Browser check first, even while the site is not under attack. */
  static readonly CHECK = 'check';
  static readonly PASS = 'pass';

  /** Each rule set's addresses as a `BlockList` (IPv4 and IPv6, single or CIDR), built once. */
  private readonly lists = new WeakMap<EdgeSiteRules, net.BlockList>();

  constructor(private readonly geo: Pick<GeoIpLookup, 'lookup'> = GeoIpLookup.shared) {}

  /** REFUSE with a reason, CHECK, or PASS. */
  verdict(req: http.IncomingMessage, rules: EdgeSiteRules): { action: string; reason?: string } {
    if (rules.isEmpty) return { action: GatewayVisitorRules.PASS };
    const address = NetworkAddressUtils.normalize(req.socket.remoteAddress);
    if (!address || NetworkAddressUtils.isPrivate(address)) return { action: GatewayVisitorRules.PASS };
    if (rules.blockedAddresses.length && this.listOf(rules).check(address, net.isIPv6(address) ? 'ipv6' : 'ipv4')) return { action: GatewayVisitorRules.REFUSE, reason: 'blocked_address' };
    if (!rules.blockedCountries.length && !rules.challengedCountries.length) return { action: GatewayVisitorRules.PASS };
    const country = this.geo.lookup(address)?.countryCode ?? '';
    if (country && rules.blockedCountries.includes(country)) return { action: GatewayVisitorRules.REFUSE, reason: 'blocked_country' };
    if (country && rules.challengedCountries.includes(country)) return { action: GatewayVisitorRules.CHECK };
    return { action: GatewayVisitorRules.PASS };
  }

  private listOf(rules: EdgeSiteRules): net.BlockList {
    const known = this.lists.get(rules);
    if (known) return known;
    const list = new net.BlockList();
    for (const entry of rules.blockedAddresses) {
      const [address, bits] = entry.split('/');
      const family = net.isIPv6(address) ? 'ipv6' : net.isIPv4(address) ? 'ipv4' : null;
      if (!family) continue;
      const prefix = Number(bits);
      try {
        if (bits === undefined) list.addAddress(address, family);
        else if (Number.isInteger(prefix)) list.addSubnet(address, prefix, family);
      } catch {
        // A malformed entry blocks nothing rather than everything.
      }
    }
    this.lists.set(rules, list);
    return list;
  }
}
