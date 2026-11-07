import { ApplicationDomainSettingsUtils, ApplicationUrlUtils, SystemConstants } from '@fromcode119/core';

/**
 * Settings → General → Domain aliases of an install with no sites. The gateway routes each one to the
 * storefront (`TenantRouteMap.build`), so each is a served host that needs a certificate.
 */
export class SingleSiteAliasHosts {
  static read(settingsCache: Map<string, string>, siteCount: number): string[] {
    if (siteCount || !ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP)) return [];
    return ApplicationDomainSettingsUtils.parseDomainAliases(settingsCache.get(SystemConstants.META_KEY.DOMAIN_ALIASES))
      .map((alias) => alias.trim().toLowerCase())
      .filter(Boolean);
  }
}
