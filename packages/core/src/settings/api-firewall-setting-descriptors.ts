import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';
import { NetworkAddressUtils } from '@core/security/network-address-utils';
import { SystemSettingSeedDefaults } from '@core/settings/system-setting-seed-defaults';

/**
 * The API firewall rows of {@link SystemSettingDescriptors} — Settings → Security → API Firewall. All
 * PLATFORM-scoped: they are read from the API's settings cache, which an untenanted read fills with the
 * platform row only (see `RateLimitSettingsUtils`). The plugin database quota counts per plugin per site.
 */
export class ApiFirewallSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.RATE_LIMIT_MAX]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '600', description: "Maximum anonymous requests per rate-limit window per IP (window set by Rate Limit Window, default one minute).", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_MAX_AUTHENTICATED]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '2000', description: "Maximum requests per rate-limit window for signed-in requests (counted per IP + token; window set by Rate Limit Window, default one minute).", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '20000', description: "Maximum requests per rate-limit window for internal server-to-server calls (the storefront renderer), counted per calling service address (window set by Rate Limit Window, default one minute).", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: NetworkAddressUtils.PRIVATE_RANGES_TEXT, description: "Addresses/CIDR blocks that count as internal service callers (the storefront renderer, workers). Clear it and nothing is internal: every anonymous caller falls back to the public limit.", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_EDGE_PROVIDER_RANGES]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: () => SystemSettingSeedDefaults.edgeProviderRangesDefault(), description: "Each registered edge provider's published IP ranges, trusted to set that provider's real-visitor header (e.g. Cloudflare's CF-Connecting-IP). JSON, keyed by the provider's own key (\"cloudflare\", ...). Seeded with the ranges built into the code; extend a provider's entry if it publishes a new range before the platform is updated. Never remove a range here to reduce trust — that requires a code change.", group: "security" },
    },
    [SystemConstants.META_KEY.TRUSTED_RELAYS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '', description: "Addresses (or CIDR blocks) of the relays in front of this platform — the platform's own edge run on another server, on an address of its own. Only a connection from one of these may name the visitor; from anywhere else that claim is ignored. Empty: no relay, every visitor is the address that connected.", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_WINDOW]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '60000', description: "Rate limit window in milliseconds. Fixed-window: tripping the limit locks a caller out for up to this long, so keep it short.", group: "security" },
    },
    [SystemConstants.META_KEY.PLUGIN_DB_CALLS_PER_MINUTE]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '0', description: "Database calls one plugin may make for one site per minute. 0 = unlimited.", group: "security" },
    },
  };
}
