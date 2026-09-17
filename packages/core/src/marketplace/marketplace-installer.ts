import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IPluginInstallProgressReporter } from '@core/plugin/interfaces/plugin-install-progress-reporter.interface';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { CoreServices } from '@core/services/core-services';
import { MarketplaceClient, MarketplacePlugin } from '@fromcode119/marketplace-client';
import { pipeline } from 'stream/promises';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';

/**
 * Fetching a plugin package and putting it on disk — including working out WHICH version that is.
 *
 * Version resolution is a comparison, not a string match: a catalogue lists versions in whatever
 * order it pleases, so the newest is the one that compares highest, part by part. Asking for a
 * specific version that the catalogue does not list fails rather than falling back to the newest,
 * because silently installing something other than what was asked for is how a pinned deployment
 * drifts.
 *
 * A LOCAL package path short-circuits the download entirely, which is what makes an air-gapped or
 * self-hosted marketplace work at all.
 *
 * Split out of `MarketplaceCatalogService` (355 lines), which reads the catalogue.
 */
export class MarketplaceInstaller {
  constructor(
    private readonly logger: any,
    private readonly discovery: DiscoveryService,
    private readonly manifestCache: any,
    private readonly ensureClient: () => Promise<{ client: MarketplaceClient | null; url: string | null }>,
    private readonly fetchCatalog: () => Promise<MarketplacePlugin[]>,
  ) {}

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
    const localPath = await MarketplaceInstaller.resolveLocalPackage(plugin, slug);
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

  resolvePluginVersion(
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

  compareVersions(left: string, right: string): number {
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
