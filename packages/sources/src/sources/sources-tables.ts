export class SourcesCollectionRegistry {
  /**
   * Which repositories this installation builds — platform configuration, not a site's content.
   *
   * `_system_` is load-bearing, not cosmetic: tenant scoping is derived from the table NAME, and
   * under the old `fcp_sources_builds` the boot sweep put row-level security on it. Every site's
   * admin then saw an empty Sources screen except whichever one created each row, and the scheduled
   * build — which runs outside any request, so with no site in scope — saw nothing at all and never
   * built anything. See migration 036.
   */
  static readonly BUILDS = '_system_sources_builds';
}
