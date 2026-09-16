import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';

/**
 * The absolute base URL of the SITE this code is running for.
 *
 * Every link the platform puts in an email was built from the deployment's own configured URL — the
 * PLATFORM's host, which carries no tenant. A recipient clicking one lands on a host where tenancy
 * cannot resolve them, and the link 404s. That is one bug in every plugin that mails a link, not one
 * bug per plugin, so it is answered here rather than in any of them.
 *
 * WHERE THE SCHEME COMES FROM. A tenant record holds hosts, never a scheme, and inventing one breaks
 * a real deployment in one direction or the other: local development serves `http://*.framework.local`
 * and production serves `https://`. So the scheme is taken from the address this deployment already
 * declares for that same app — if the operator configured `https://console.example.com`, this
 * installation speaks https, and its sites are reached the same way. Nothing is guessed.
 *
 * WHEN IT CANNOT ANSWER it returns the platform's configured URL, which is exactly what every caller
 * used before. No site bound (a boot, a timer, a background job), a single-site deployment, a tenant
 * that cannot be resolved, a tenant with no host, or no configured URL to take a scheme from — each
 * falls back rather than returning nothing, because a relative link in an email is worse than a link
 * to the platform.
 */
export class SiteBaseUrl {
  private static readonly logger = new Logger({ namespace: 'site-base-url' });
  private static database: unknown = null;

  /** Wire the database once it is up, exactly as the settings accessors are. */
  static registerDatabase(db: unknown): void {
    SiteBaseUrl.database = db;
  }

  /** Kept so tests can unwire between cases. */
  static reset(): void {
    SiteBaseUrl.database = null;
  }

  /**
   * The base URL for `app` — `ApplicationUrlUtils.FRONTEND_APP` or `API_APP` — as the current site.
   *
   * Always a clean base with no trailing slash, the same contract as
   * {@link ApplicationUrlUtils.readAppBaseUrlFromEnvironment}, so `joinApiPath` appends to it exactly
   * as it always did.
   */
  static async forCurrentSite(app: string): Promise<string> {
    const platform = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(app);

    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!TenantMode.isEnabled() || !tenantId || !SiteBaseUrl.database) return platform;

    // No configured URL means no declared scheme, and a scheme is the one thing a tenant record
    // cannot supply. Falling back keeps today's behaviour instead of inventing http or https.
    const scheme = SiteBaseUrl.schemeOf(platform);
    if (!scheme) return platform;

    try {
      const tenant = await TenantResolverService.shared(SiteBaseUrl.database).resolveById(tenantId);
      const host = SiteBaseUrl.hostFor(tenant, app);
      return host ? `${scheme}://${host}` : platform;
    } catch (error: unknown) {
      SiteBaseUrl.logger.warn(
        `Could not resolve the base URL for site "${tenantId}"; using the platform's. `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
      return platform;
    }
  }

  /**
   * The host to address this site by, for this app.
   *
   * The API is reached on the site's `api.` alias when it has one, because that is the host the
   * gateway sends to the api — a link to the site's own domain would arrive at the FRONTEND. With no
   * such alias the primary host is the honest answer: single-host deployments serve the api under it.
   */
  private static hostFor(tenant: { primaryHost?: string; apiHosts?: () => string[] } | null, app: string): string {
    if (!tenant) return '';
    if (app === ApplicationUrlUtils.API_APP) {
      const apiHost = (tenant.apiHosts?.() ?? [])[0];
      if (apiHost) return apiHost;
    }
    return String(tenant.primaryHost ?? '').trim();
  }

  /** `https` out of `https://console.example.com`, or '' when there is nothing to read it from. */
  private static schemeOf(baseUrl: string): string {
    const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(String(baseUrl ?? '').trim());
    return match ? match[1].toLowerCase() : '';
  }
}
