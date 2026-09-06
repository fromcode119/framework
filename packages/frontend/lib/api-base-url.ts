import { ApplicationUrlUtils, EnvUtils } from '@fromcode119/core/client';

export class FrontendApiBaseUrl {
  /**
   * Where the storefront calls the API.
   *
   * In the BROWSER the answer is always this page's own origin, and it takes no configuration. On a
   * multi-site deployment every site is its own host, and that host is the only thing that says WHICH
   * site a call belongs to — send the browser to one shared api host and the site is gone, which is how
   * a shop with Econt credentials ended up reading the platform's empty ones. Behind the gateway those
   * paths route straight to the api; without it the storefront's own `/api` route proxies them, for
   * every method.
   *
   * On the SERVER there is no origin to speak of, so the configured base still answers.
   */
  static resolveFrontendApiBaseUrl(explicit?: string): string {
      if (EnvUtils.isBrowser()) {
        const origin = FrontendApiBaseUrl.trimTrailingSlashes(String((window as any)?.location?.origin || ''));
        if (origin) return origin;
      }

      const fromExplicit = FrontendApiBaseUrl.normalizeCandidate(String(explicit || ''));
      if (fromExplicit) return fromExplicit;

      const fromEnv = FrontendApiBaseUrl.normalizeCandidate(String(process.env.NEXT_PUBLIC_API_URL || ''));
      if (fromEnv) return fromEnv;

      return '';
  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static trimTrailingSlashes(value: string): string {
    return value.replace(/\/+$/, '');
  }

  private static normalizeCandidate(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return ApplicationUrlUtils.normalizeBaseUrlCandidate(raw, { stripApiPath: true });
    }
    if (raw.startsWith('/')) return FrontendApiBaseUrl.trimTrailingSlashes(raw);
    return FrontendApiBaseUrl.trimTrailingSlashes(`http://${raw}`);
  }

}
