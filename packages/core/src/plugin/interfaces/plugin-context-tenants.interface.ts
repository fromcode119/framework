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
}
