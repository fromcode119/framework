import { lookup } from 'node:dns/promises';
import { NetworkAddressUtils } from '@core/security/network-address-utils';

/** Fail-closed validation for operator-configured outbound HTTP targets. */
export class OutboundUrlSecurityPolicy {
  static async isPublicHttpUrl(rawUrl: string): Promise<boolean> {
    let url: URL;
    try {
      url = new URL(String(rawUrl || ''));
    } catch {
      return false;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.username || url.password || !url.hostname) return false;

    try {
      const addresses = await lookup(url.hostname, { all: true, verbatim: true });
      return addresses.length > 0 && addresses.every((entry) => NetworkAddressUtils.isPublic(entry.address));
    } catch {
      return false;
    }
  }
}
