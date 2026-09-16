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

  constructor(private discovery: DiscoveryService) {}

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
      return plugins;
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
    return this.resolvePluginVersion(catalog, slug, version);
  }

  /**
   * Download and install a plugin from the marketplace, including its dependencies
   */
  public async downloadAndInstall(
    slug: string,
    visited: Set<string> = new Set(),
    progressReporter?: IPluginInstallProgressReporter,
    version?: string,
  ): Promise<IPluginManifest> {
    // Resolved once for this install and carried down, rather than re-read per step: an install
    // downloads dependencies too, and every one of them must come from the SAME catalogue the plugin
    // was found in.
    const { client } = await this.ensureClient();
    if (!client) {
      throw new Error('Marketplace is disabled.');
    }

    if (visited.has(slug)) {
      this.logger.debug(`Skipping already processed dependency: ${slug}`);
      const cached = this.manifestCache.get(slug);
      if (cached) return cached;
      
      // If visited but not in cache, it might be a circular dependency or already installed
      // Attempt to return a basic manifest if we can't find anything better
      return { slug, version: 'current' } as any; 
    }
    visited.add(slug);

    const plugin = await this.resolvePluginVersion(await this.fetchCatalog(), slug, version);
    if (!plugin) {
      throw new Error(`Plugin "${slug}"${version ? ` v${version}` : ''} not found in marketplace catalog.`);
    }

    progressReporter?.({
      phase: 'resolving-marketplace-package',
      message: `Preparing marketplace package "${slug}"...`,
      pluginSlug: slug,
    });

    // 1. Resolve and install dependencies first
    if (plugin.dependencies && Object.keys(plugin.dependencies).length > 0) {
      this.logger.info(`Installing dependencies for ${slug}: ${Object.keys(plugin.dependencies).join(', ')}`);
      for (const depSlug of Object.keys(plugin.dependencies)) {
        try {
          progressReporter?.({
            phase: 'installing-dependency',
            message: `Installing dependency "${depSlug}" required by "${slug}"...`,
            pluginSlug: slug,
            dependencySlug: depSlug,
          });
          await this.downloadAndInstall(depSlug, visited, progressReporter);
        } catch (err: any) {
          this.logger.error(`Dependency "${depSlug}" failed for "${slug}": ${err.message}`);
          throw new Error(`Failed to install dependency "${depSlug}" for plugin "${slug}": ${err.message}`);
        }
      }
    }

    // AN OFFER FROM THIS INSTALLATION IS A FILE ON DISK, NOT A URL.
    //
    // The catalogue merges remote entries with ones contributed by this installation, and a
    // contributed row borrows the marketplace shape — whose only location is `downloadUrl`, a bare
    // filename. Resolving that against the remote marketplace produced
    // `https://marketplace.example.com/.../<slug>-<version>.zip` for a package sitting in this
    // installation's own workspace, so every locally built plugin failed to install. The theme
    // controller already handled this; doing it here means the five callers that funnel through
    // `downloadAndInstall` — the Update button, batch update-all, theme dependencies and the forge
    // tools — are all fixed rather than one of them.
    const localPath = await MarketplaceCatalogService.resolveLocalPackage(plugin, slug);
    if (localPath) {
      this.logger.info(`Installing plugin "${slug}" from this installation: ${localPath}`);
      const manifest = fs.statSync(localPath).isDirectory()
        ? await this.discovery.installFromDirectory(localPath)
        : await this.discovery.installFromZip(localPath);
      return manifest;
    }

    this.logger.info(`Downloading and installing plugin: ${slug} v${plugin.version}`);

    // Resolve absolute download URL
    const downloadUrl = client.resolveDownloadUrl(plugin.downloadUrl);

    // os.tmpdir(), never the working directory: cwd is `/app/packages/api`, which is root-owned in
    // the image while the api runs as an unprivileged user — so this threw EACCES on every install,
    // before the download was even attempted. `mkdtemp` also gives each install its own directory
    // rather than a shared one two installs can race in.
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-plugin-'));

    const tempZipPath = path.join(tempDir, `${slug}-${Date.now()}.zip`);

    try {
      this.logger.debug(`Downloading from ${downloadUrl}...`);
      progressReporter?.({
        phase: 'downloading-package',
        message: `Downloading "${slug}" from marketplace...`,
        pluginSlug: slug,
      });
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download plugin: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }

      const fileStream = fs.createWriteStream(tempZipPath);
      // @ts-ignore - native fetch body is not exactly same as node streams but pipeline handles it in Node 18+
      await pipeline(response.body, fileStream);

      progressReporter?.({
        phase: 'extracting-package',
        message: `Extracting "${slug}" package...`,
        pluginSlug: slug,
      });
      const manifest = await this.discovery.installFromZip(tempZipPath);
      this.manifestCache.set(slug, manifest);
      this.logger.info(`Successfully installed plugin: ${slug} (v${manifest.version})`);
      return manifest;
    } catch (error: any) {
      this.logger.error(`Installation failed for ${slug}: ${error.message}`);
      throw error;
    } finally {
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
    }
  }

  private resolvePluginVersion(
    catalog: MarketplacePlugin[],
    slug: string,
    version?: string,
  ): MarketplacePlugin | undefined {
    const matches = catalog.filter((plugin) => plugin.slug === slug);
    if (matches.length === 0) {
      return undefined;
    }

    const normalizedVersion = String(version || '').trim();
    if (normalizedVersion) {
      return matches.find((plugin) => plugin.version === normalizedVersion);
    }

    return matches.sort((left, right) => this.compareVersions(right.version, left.version))[0];
  }

  private compareVersions(left: string, right: string): number {
    const leftParts = String(left || '').split('.').map((part) => Number(part.replace(/\D/g, '')) || 0);
    const rightParts = String(right || '').split('.').map((part) => Number(part.replace(/\D/g, '')) || 0);
    const maxLength = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < maxLength; index += 1) {
      const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  }
  /**
   * Where a locally built package actually is, or null when the offer came from a remote catalogue.
   *
   * Asked of the catalogue-contribution registry rather than of any named producer: core must not
   * know that something called Sources exists, only that whatever offered the package can say where
   * it put it. The path is resolved from the offer the server itself looked up, so nothing a caller
   * sent chooses which file is opened.
   */
  private static async resolveLocalPackage(pkg: unknown, slug: string): Promise<string | null> {
    const offer = CoercionUtils.toObject(pkg);
    if (CoercionUtils.toString(offer.source) !== 'local') return null;

    const resolved = await CoreServices.getInstance().catalogContributions.resolveArtifact(
      slug,
      CoercionUtils.toString(offer.kind) || 'plugin',
    );
    if (!resolved) {
      // Never fall through to the remote URL. The offer said this installation has the package; if
      // it cannot be found, that is a fault to report, not a reason to go asking a retired host.
      throw new Error(`Plugin "${slug}" was offered by this installation but its package could not be found.`);
    }
    return resolved;
  }
}
