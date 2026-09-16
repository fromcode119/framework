import type { INetworkEdgeProvider } from '@core/security/interfaces/network-edge-provider.interface';
import { CloudflareEdgeProvider } from '@core/security/providers/cloudflare/cloudflare-edge-provider';

/**
 * Every network-edge provider this platform knows how to trust.
 *
 * Adding a second real provider (Fastly, CloudFront, ...) is one more small class implementing
 * `INetworkEdgeProvider` plus one more entry here — `NetworkAddressUtils.resolveClientIp` and every
 * call site stay untouched, because they walk this list rather than naming a vendor.
 */
export class NetworkEdgeProviderRegistry {
  static readonly ALL: ReadonlyArray<INetworkEdgeProvider> = [new CloudflareEdgeProvider()];

  /** `provider.defaultRanges` as the comma-separated CIDR text an operator edits in admin. */
  static rangesTextFor(provider: INetworkEdgeProvider): string {
    return provider.defaultRanges.map(([address, prefix]) => `${address}/${prefix}`).join(', ');
  }

  static byKey(key: string): INetworkEdgeProvider | undefined {
    return NetworkEdgeProviderRegistry.ALL.find((provider) => provider.key === key);
  }
}
