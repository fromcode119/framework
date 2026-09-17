import { ApplicationUrlUtils, SystemConstants } from '@fromcode119/core';

/**
 * Where `ApplicationUrlUtils` gets the platform's app URLs from at runtime.
 *
 * SETTING-first, not env-first — a stale "env always wins" comment lived beside this and is what made
 * `site_url` an invisible source of app URLs. It matters because the frontend resolves from
 * `frontend_url` OR `site_url`, so this reader answers with a URL even on a deployment that runs no
 * frontend.
 *
 * Anything choosing where to send a CREDENTIAL must use
 * `ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment`, which deliberately ignores this.
 */
export class ServerAppUrlReader {
  /** Point the resolver at the live settings cache, so a URL changed in admin Settings propagates. */
  static register(settingsCache: Map<string, string>): void {
    ApplicationUrlUtils.registerAppUrlSettingsReader((app: string) => {
      if (app === ApplicationUrlUtils.ADMIN_APP) {
        return settingsCache.get(SystemConstants.META_KEY.ADMIN_URL) || null;
      }
      if (app === ApplicationUrlUtils.FRONTEND_APP) {
        return settingsCache.get(SystemConstants.META_KEY.FRONTEND_URL)
          || settingsCache.get(SystemConstants.META_KEY.SITE_URL)
          || null;
      }
      if (app === ApplicationUrlUtils.API_APP) {
        // Was env-only, which made the api the one platform host an operator could not change without
        // editing a deployment's `.env` and redeploying — while admin/frontend, the same kind of
        // value, were a field in Settings. Setting-first now, like its siblings; env is the fallback.
        return settingsCache.get(SystemConstants.META_KEY.API_URL) || null;
      }
      return null;
    });
  }
}
