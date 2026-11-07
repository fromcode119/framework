import { NetworkAddressUtils } from '@core/security/network-address-utils';
import { NetworkEdgeProviderRegistry } from '@core/security/providers/network-edge-provider-registry';

/**
 * The seed values that can only be known at boot.
 *
 * Most declared settings seed a literal. The edge-provider ranges cannot: they come from the provider
 * registry, as a thunk evaluated once when the seed runs. App URLs are NOT seeded from anywhere — a
 * domain is set in the setup wizard and in Settings → General, never in the deployment.
 */
export class SystemSettingSeedDefaults {
  /**
   * Every registered edge provider's published ranges, as the JSON object `resolveNetworkEdgeRanges`
   * expects — keyed by each provider's own `key`, built by walking `NetworkEdgeProviderRegistry.ALL`
   * rather than naming a vendor. Adding a second provider needs no change here.
   */
  static edgeProviderRangesDefault(): string {
    return JSON.stringify(
      Object.fromEntries(
        NetworkEdgeProviderRegistry.ALL.map((provider) => [provider.key, NetworkEdgeProviderRegistry.rangesTextFor(provider)]),
      ),
    );
  }
}
