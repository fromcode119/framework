import { Logger } from '@core/logging';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';
import { MarketplaceClient, MarketplacePlugin } from '@fromcode119/marketplace-client';
import { MarketplaceUrlService } from '@fromcode119/marketplace-client';
import { SiteMarketplaceUrl } from '@core/marketplace/site-marketplace-url';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import type { IPluginInstallProgressReporter } from '@core/plugin/interfaces/plugin-install-progress-reporter.interface';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { CoreServices } from '@core/services/core-services';
import { CatalogEntry } from '@core/marketplace/contributions/catalog-entry';
import { CatalogContributionScope } from '@core/marketplace/catalog-contribution-scope';
import { SystemConstants } from '@core/constants/system.constants';
import { MarketplaceInstaller } from '@core/marketplace/marketplace-installer';

export class MarketplaceCatalogService {
  private logger = new Logger({ namespace: 'marketplace' });
  private manifestCache = new Map<string, IPluginManifest>();

  /**
   * One resolved catalogue per SITE, keyed by `SiteMarketplaceUrl.currentScopeKey()` (`''` is the
   * platform's).
   *
   * A single client held for the life of the process was correct only while every site browsed the
   * same catalogue. Now that a site can point at its own, that cache would hand the FIRST site's
   * marketplace to every site after it — a cross-tenant leak created by a cache, not by a filter.
   */
  private resolvedByScope = new Map<string, { client: MarketplaceClient | null; url: string | null }>();

  private readonly installer: MarketplaceInstaller;

  constructor(private discovery: DiscoveryService) {
    this.installer = new MarketplaceInstaller(
      this.logger,
      discovery,
      this.manifestCache,
      () => this.ensureClient(),
      () => this.fetchCatalog(),
    );
  }

  /**
   * Lazily resolve the marketplace URL as `env ?? _system_meta setting ?? default` and
   * build the client. Resolution is deferred (not done in the constructor) so the DB-backed
   * setting can be consulted once it's available; env still wins when set.
   */
  private async ensureClient(): Promise<{ client: MarketplaceClient | null; url: string | null }> {
    const scope = SiteMarketplaceUrl.currentScopeKey();
    const cached = this.resolvedByScope.get(scope);
    if (cached) return cached;

    // The SITE's own catalogue when it has chosen one, the platform's otherwise. One key answers both
    // — the settings store is partitioned by site, so a site's row and the platform's live under the
    // same name without colliding, and the policy already lets a site read the platform's.
    const raw = await SiteMarketplaceUrl.current(process.env.MARKETPLACE_URL);
    const normalized = raw.toLowerCase();
    if (normalized === 'off' || normalized === 'false' || normalized === 'disabled') {
      this.logger.info(`Marketplace disabled for ${scope ? `site "${scope}"` : 'the platform'}.`);
      const off = { client: null, url: null };
      this.resolvedByScope.set(scope, off);
      return off;
    }

    const url = MarketplaceUrlService.resolveCatalogUrl(
      !raw || normalized === 'undefined' || normalized === 'null' ? undefined : raw,
    );
    const resolved = { client: new MarketplaceClient(url), url };
    this.resolvedByScope.set(scope, resolved);
    return resolved;
  }

  /**
   * Forget a resolved catalogue so the next read re-resolves.
   *
   * Called when the setting changes. Without it a site that corrected its marketplace URL would go on
   * browsing the old one for the life of the process — the "saved but not in effect" shape this
   * codebase closes everywhere else.
   */
  public invalidateResolvedCatalogue(scopeKey?: string): void {
    if (scopeKey === undefined) this.resolvedByScope.clear();
    else this.resolvedByScope.delete(scopeKey);
  }

  /**
   * Fetch the full plugin catalog from the marketplace
   */
  public async fetchCatalog(): Promise<MarketplacePlugin[]> {
    const remote = await this.fetchRemoteCatalog();
    // What THIS installation built is the operator's own inventory, not a catalogue — on a
    // multi-tenant platform it is other customers' bespoke plugins. A site is offered the remote
    // catalogue only; see `CatalogContributionScope`.
    const contributed = CatalogContributionScope.offeredHere() ? await this.fetchContributedCatalog() : [];

    /**
     * Contributed entries win a tie.
     *
     * Something built from a repository on THIS installation is newer than the same slug in a
     * shared catalogue by definition — it was produced from source the operator controls. Letting
     * the remote win would offer a published version as an "update" over a locally built one.
     */
    const merged = new Map<string, MarketplacePlugin>();
    for (const entry of [...remote, ...contributed]) {
      merged.set(String((entry as any)?.slug || '').toLowerCase(), entry);
    }
    return Array.from(merged.values());
  }

  private async fetchRemoteCatalog(): Promise<MarketplacePlugin[]> {
    try {
      const { client, url } = await this.ensureClient();
      if (!client || !url) {
        return [];
      }
      this.logger.debug(`Fetching marketplace catalog from: ${url}`);
      const data = await client.fetch();
      const plugins = data.plugins || [];
      // "Successfully fetched 0 plugins" was logged after a 503, because the client swallows the
      // failure and hands back an empty list — so a retired marketplace looked like an empty one, and
      // the install carried on as though the catalogue had simply offered nothing. An empty answer is
      // reported as what it is; whether it is a real emptiness or a swallowed error, it is not a
      // success worth claiming.
      if (plugins.length === 0) {
        this.logger.warn(`Marketplace at ${url} returned no plugins — it may be unreachable or retired.`);
        return [];
      }
      this.logger.info(`Successfully fetched ${plugins.length} plugins from marketplace.`);
      // Stamped explicitly rather than left undefined: the merged list is the only place the two
      // origins meet, and a missing marker would read as "unknown" for exactly half of it.
      return plugins.map((plugin: any) => ({ ...plugin, source: 'remote' }));
    } catch (err: any) {
      this.logger.error(`Failed to fetch marketplace catalog: ${err.message}`);
      return [];
    }
  }

  /**
   * Versions offered by something on this installation rather than by a remote catalogue.
   *
   * This is what lets an installation with NO marketplace answer "is there a newer version" at all.
   * A contributor that throws is skipped rather than emptying the catalogue: one broken source must
   * not hide every other update.
   */
  private async fetchContributedCatalog(): Promise<MarketplacePlugin[]> {
    const entries: MarketplacePlugin[] = [];
    for (const contributor of CoreServices.getInstance().catalogContributions.list()) {
      try {
        const rows = await contributor.list();
        for (const row of rows || []) {
          const entry = CatalogEntry.from(row);
          if (entry) entries.push(entry.toCatalogPlugin() as unknown as MarketplacePlugin);
        }
      } catch (err: any) {
        this.logger.warn(`Catalog contributor ${contributor.canonicalKey} failed: ${err?.message || err}`);
      }
    }
    return entries;
  }

  /**
   * Search for plugins in the catalog
   */
  public async searchPlugins(query: string): Promise<MarketplacePlugin[]> {
    const catalog = await this.fetchCatalog();
    const q = query.toLowerCase();
    return catalog.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.slug.toLowerCase().includes(q) || 
      p.description?.toLowerCase().includes(q)
    );
  }

  /**
   * Get detailed information for a single plugin
   */
  public async getPluginInfo(slug: string, version?: string): Promise<MarketplacePlugin | undefined> {
    const catalog = await this.fetchCatalog();
    return this.installer.resolvePluginVersion(catalog, slug, version);
  }

  /** @see MarketplaceInstaller.downloadAndInstall */
  downloadAndInstall(...args: Parameters<MarketplaceInstaller["downloadAndInstall"]>): ReturnType<MarketplaceInstaller["downloadAndInstall"]> {
    return this.installer.downloadAndInstall(...args);
  }

}
