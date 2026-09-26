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
    return (await SiteBaseUrl.forSite(tenantId, app)) || platform;
  }

  /**
   * The base URL of the site `tenantId`, or '' when it cannot be answered.
   *
   * Unlike {@link forCurrentSite} this does NOT fall back to the platform's URL. A caller that SHOWS
   * the address — "this site is served at …" — must not print the platform's host as the site's, so
   * it gets nothing and says nothing.
   */
  static async forSite(tenantId: string, app: string): Promise<string> {
    const id = String(tenantId ?? '').trim();
    if (!TenantMode.isEnabled() || !id || !SiteBaseUrl.database) return '';

    // No configured URL means no declared scheme, and a scheme is the one thing a tenant record
    // cannot supply. Answering nothing keeps the caller's own fallback instead of inventing one.
    const scheme = SiteBaseUrl.declaredScheme(app);
    if (!scheme) return '';

    try {
      const tenant = await TenantResolverService.shared(SiteBaseUrl.database).resolveById(id);
      const host = SiteBaseUrl.hostFor(tenant, app);
      return host ? `${scheme}://${host}` : '';
    } catch (error: unknown) {
      SiteBaseUrl.logger.warn(
        `Could not resolve the base URL for site "${id}". `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
      return '';
    }
  }

  /**
   * The host to address this site by, for this app.
   *
   * Each app is reached on a host DECLARED to serve it. The api on a host whose role is `api`,
   * because that is the host the gateway sends to the api — a link to the site's own domain would
   * arrive at the FRONTEND. The storefront on a host whose role is `storefront`: a site may declare
   * its primary host as its console, and a shop link built from the primary host then opened the
   * console. With no host declared for the app the primary host is the answer, as it always was —
   * single-host deployments serve everything under it, and a workspace has no storefront at all.
   */
  private static hostFor(
    tenant: { primaryHost?: string; apiHosts?: () => string[]; storefrontHosts?: () => string[] } | null,
    app: string,
  ): string {
    if (!tenant) return '';
    const declared = app === ApplicationUrlUtils.API_APP ? tenant.apiHosts?.() : tenant.storefrontHosts?.();
    return (declared ?? [])[0] || String(tenant.primaryHost ?? '').trim();
  }

  /**
   * The scheme this installation declares: the app's own configured URL first, then any other app's.
   *
   * A multi-site platform has no single storefront address, so its frontend URL is often left unset
   * while the console and the api are configured. Reading only the frontend then answered nothing for
   * every site — canonical links went relative and emailed links fell back to nothing — although the
   * deployment had plainly declared `https` twice. The apps sit behind one gateway and one set of
   * certificates, so a scheme declared for any of them is the scheme of all of them. Still nothing is
   * guessed: with no URL declared anywhere, there is no answer.
   */
  private static declaredScheme(app: string): string {
    const apps = [app, ApplicationUrlUtils.FRONTEND_APP, ApplicationUrlUtils.API_APP, ApplicationUrlUtils.ADMIN_APP];
    for (const candidate of apps) {
      const scheme = SiteBaseUrl.schemeOf(ApplicationUrlUtils.readAppBaseUrlFromEnvironment(candidate));
      if (scheme) return scheme;
    }
    return '';
  }

  /** `https` out of `https://console.example.com`, or '' when there is nothing to read it from. */
  private static schemeOf(baseUrl: string): string {
    const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(String(baseUrl ?? '').trim());
    return match ? match[1].toLowerCase() : '';
  }
}
