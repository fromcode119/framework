import { ApiVersionUtils } from '@core/api-version';
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
   * The absolute address of an api endpoint for the current site — `apiPath` as `ApiPathUtils` builds
   * it (`/api/plugins/<slug>/...`).
   *
   * A host DECLARED to be the api serves the api at its root (the gateway puts the base path back), so
   * there the base path is left out: `https://api.example.com/plugins/<slug>/...`. That is a site's
   * `api` host, or the platform's own api address when it is a host of its own — the one place a
   * platform-wide integration (an OAuth redirect, a webhook) is registered with no site bound. Anywhere
   * else the api lives under the base path on that app's origin, and the address keeps it. '' when this
   * deployment declares no api address at all: a relative webhook URL is no address.
   */
  static async apiUrlForCurrentSite(apiPath: string): Promise<string> {
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    const scheme = SiteBaseUrl.declaredScheme(ApplicationUrlUtils.API_APP);
    const siteApiHost = await SiteBaseUrl.declaredApiHost(tenantId);
    if (scheme && siteApiHost) return ApplicationUrlUtils.joinApiPath(`${scheme}://${siteApiHost}`, SiteBaseUrl.atApiRoot(apiPath));
    const site = await SiteBaseUrl.forSite(tenantId, ApplicationUrlUtils.API_APP);
    if (site) return ApplicationUrlUtils.joinApiPath(site, apiPath);

    const platform = SiteBaseUrl.originOf(ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP));
    if (!platform) return '';
    const shared = [ApplicationUrlUtils.ADMIN_APP, ApplicationUrlUtils.FRONTEND_APP]
      .some((app) => SiteBaseUrl.originOf(ApplicationUrlUtils.readAppBaseUrlFromEnvironment(app)) === platform);
    return ApplicationUrlUtils.joinApiPath(platform, shared ? apiPath : SiteBaseUrl.atApiRoot(apiPath));
  }

  /** The first host the site declares for the api, or '' — the primary-host fallback is not one. */
  private static async declaredApiHost(tenantId: string): Promise<string> {
    if (!TenantMode.isEnabled() || !tenantId || !SiteBaseUrl.database) return '';
    try {
      const tenant = await TenantResolverService.shared(SiteBaseUrl.database).resolveById(tenantId);
      return tenant?.apiHosts?.()[0] ?? '';
    } catch (error: unknown) {
      SiteBaseUrl.logger.warn(`Could not resolve the api host for site "${tenantId}". ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /** `/api/plugins/x` → `/plugins/x`: the same endpoint, as a host that is the api serves it. */
  private static atApiRoot(apiPath: string): string {
    const base = ApiVersionUtils.API_BASE_PATH.replace(/\/+$/, '');
    const path = `/${String(apiPath ?? '').trim().replace(/^\/+/, '')}`;
    if (!base || (path !== base && !path.startsWith(`${base}/`))) return path;
    return path.slice(base.length) || '/';
  }

  /**
   * `origin` when it is a console of THIS deployment the site may be operated from, otherwise ''.
   *
   * The browser reports which console an operator is on, and a round trip that leaves the console
   * (an OAuth dialog) returns there. A header is the caller's to write, so it is only believed when it
   * names a console the platform itself declares: the platform's own console address, a host of the
   * site, or a host of a workspace. Anything else would make the return leg an open redirect.
   */
  static async consoleOrigin(origin: string, tenantId: string): Promise<string> {
    let url: URL;
    try { url = new URL(String(origin ?? '').trim()); } catch { return ''; }
    const candidate = url.origin.toLowerCase();
    const platform = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP);
    if (platform && SiteBaseUrl.originOf(platform) === candidate) return url.origin;

    const id = String(tenantId ?? '').trim();
    const scheme = SiteBaseUrl.declaredScheme(ApplicationUrlUtils.ADMIN_APP);
    if (!TenantMode.isEnabled() || !id || !SiteBaseUrl.database || url.protocol !== `${scheme}:`) return '';
    try {
      const resolver = TenantResolverService.shared(SiteBaseUrl.database);
      const owner = await resolver.resolveByHost(url.host) ?? await resolver.resolveByHost(url.hostname);
      return owner && (owner.id === id || owner.isWorkspace) ? url.origin : '';
    } catch (error: unknown) {
      SiteBaseUrl.logger.warn(`Could not check the console origin for site "${id}". ${error instanceof Error ? error.message : String(error)}`);
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
   * console. The console on a host whose role is `admin`, for the same reason. With no host declared
   * for the app the primary host is the answer, as it always was —
   * single-host deployments serve everything under it, and a workspace has no storefront at all.
   */
  private static hostFor(
    tenant: { primaryHost?: string; apiHosts?: () => string[]; adminHosts?: () => string[]; storefrontHosts?: () => string[] } | null,
    app: string,
  ): string {
    if (!tenant) return '';
    const declared = app === ApplicationUrlUtils.API_APP ? tenant.apiHosts?.()
      : app === ApplicationUrlUtils.ADMIN_APP ? tenant.adminHosts?.()
        : tenant.storefrontHosts?.();
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

  /** `https://console.example.com` out of a configured base URL, or ''. */
  private static originOf(baseUrl: string): string {
    try { return new URL(baseUrl).origin.toLowerCase(); } catch { return ''; }
  }

  /** `https` out of `https://console.example.com`, or '' when there is nothing to read it from. */
  private static schemeOf(baseUrl: string): string {
    const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(String(baseUrl ?? '').trim());
    return match ? match[1].toLowerCase() : '';
  }
}
