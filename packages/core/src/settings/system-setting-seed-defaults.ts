import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { NetworkAddressUtils } from '@core/security/network-address-utils';
import { NetworkEdgeProviderRegistry } from '@core/security/providers/network-edge-provider-registry';

/**
 * The seed values that can only be known at boot.
 *
 * Most declared settings seed a literal. These two cannot: the app URLs come from the environment,
 * and the edge-provider ranges come from the provider registry. They are thunks in the descriptor
 * table, evaluated once when the seed runs — so they live here rather than inline, where a table of
 * declarations would have had two functions in the middle of it.
 */
export class SystemSettingSeedDefaults {
  /**
   * The app URLs, read from the environment at seed time.
   *
   * Here rather than at the call site because these are DEFAULTS for declared settings, and the
   * declaration is what this file owns. `ApplicationUrlUtils` is the framework's own resolver, so
   * nothing about which env var means which app leaks into the seed.
   */
  static urlDefaults(): { siteUrl: string; frontendUrl: string; adminUrl: string; apiUrl: string; platformDomain: string } {
    const frontendUrl = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP);
    const adminUrl = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP);
    const apiUrl = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP);
    return { siteUrl: frontendUrl, frontendUrl, adminUrl, apiUrl, platformDomain: ApplicationUrlUtils.derivePlatformDomain(frontendUrl, adminUrl) };
  }

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
