/**
 * The `context.tenants` surface of {@link PluginContext}.
 *
 * A deployment may serve one site or many. A plugin never scopes its own queries — the framework does
 * that, whether or not the plugin asks — but work that runs OUTSIDE a request (a boot-time backfill,
 * a default row, a one-off normalisation) has no site to belong to, and there was previously no way
 * to say "do this for each of them". Such work was skipped or refused, silently, for every site.
 */
export interface IPluginContextTenants {
  /**
   * Runs `work` once per site, each inside that site's own scope.
   *
   * Inside a request it runs once, for the current site — the only site the request is about. A site
   * whose run throws is logged against its own id and does not stop the others. Returns how many
   * sites it ran for.
   */
  forEach(work: () => Promise<void>): Promise<number>;

  /**
   * The site this code is running for, or null outside a request (boot, a timer, a job).
   *
   * Async in both worlds: an isolated plugin runs in its own process and must ask the host. A
   * signature that differed between them is the shape of bug this whole surface exists to prevent.
   */
  current(): Promise<string | null>;

  /** Whether this deployment serves more than one site. For deciding whether to fan work out. */
  isMultiSite(): Promise<boolean>;

  /**
   * The absolute base URLs of the site this code is running for — use them for any link that leaves
   * the platform. Outside a request, or on a single-site deployment, the platform's configured URLs.
   * `admin` is the console's: where no site is bound it is the platform console, the one address a
   * platform-wide integration (an OAuth redirect, a webhook) can be registered at.
   */
  baseUrls(): Promise<{ frontend: string; api: string; admin: string }>;

  /**
   * The absolute address of an api endpoint (`ApiPathUtils.pluginPath(slug, path)`) for the site this
   * code runs for — or, with no site bound, the platform's. On a host that is the api the base path is
   * left out (`https://api.example.com/plugins/<slug>/...`); elsewhere it is kept. '' when no api
   * address is declared.
   */
  apiUrl(apiPath: string): Promise<string>;
}
