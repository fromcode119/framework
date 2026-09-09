import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
import * as fs from 'fs';
import * as path from 'path';
import { BackupService } from '@core/management/backup-service';
import { PluginMigrationLoader } from '@core/database/plugin-migration-loader';
import { Logger } from '@core/logging';
import { MigrationManager } from '@core/database/migration-manager';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';
import { MarketplaceCatalogService } from '@core/marketplace/marketplace-catalog-service';
import { VersionComparisonService } from '@core/services/version-comparison-service';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';
import type { IPluginInstallProgressReporter } from '@core/plugin/interfaces/plugin-install-progress-reporter.interface';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import { PluginRuntimeRestartService } from '@core/plugin/services/runtime/plugin-runtime-restart-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

export class PluginInstallationService {
  constructor(
    private readonly logger: Logger,
    private readonly marketplace: MarketplaceCatalogService,
    private readonly discovery: DiscoveryService,
    private readonly migrationManager: MigrationManager,
    private readonly registry: PluginStateService,
    private readonly runtimeRestart: PluginRuntimeRestartService,
    private readonly plugins: Map<string, ILoadedPlugin>,
    private readonly pluginsRoot: string,
    private readonly discoverPlugins: () => Promise<void>,
    private readonly enablePlugin: (slug: string) => Promise<void>,
    /** T5: swap an isolated plugin's process for one running the new files; false when it runs in the api process. */
    private readonly reloadHost: (slug: string, manifest: IPluginManifest) => Promise<boolean> = async () => false,
  ) {}

  /** Set when a replaced plugin could NOT be reloaded in place (shared) and a deferred api restart is owed. */
  private restartOwed = false;

  async installOrUpdateFromMarketplace(
    slug: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter; version?: string; deferRestart?: boolean } = {},
  ): Promise<IPluginManifest> {
    const pkg = await this.marketplace.getPluginInfo(slug, options.version);
    if (!pkg) {
      throw new Error(`Plugin "${slug}"${options.version ? ` v${options.version}` : ''} not found in marketplace.`);
    }

    options.progressReporter?.({
      phase: 'resolving-marketplace-package',
      message: `Checking marketplace package for "${slug}"...`,
      pluginSlug: slug,
    });

    if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
      options.progressReporter?.({
        phase: 'dependencies-ready',
        message: `Required dependencies: ${Object.keys(pkg.dependencies).join(', ')}`,
        pluginSlug: slug,
      });
    }

    const existing = this.plugins.get(slug);
    if (existing?.path) {
      this.logger.info(`Creating backup for ${slug} before update...`);
      options.progressReporter?.({
        phase: 'creating-backup',
        message: `Creating backup for "${slug}" before update...`,
        pluginSlug: slug,
      });
      await BackupService.create(slug, existing.path, BackupSectionKey.PLUGINS);
    }

    const manifest = await this.marketplace.downloadAndInstall(slug, new Set(), options.progressReporter, options.version);
    await this.finalizeInstalledPlugin(manifest.slug, {
      enable: options.enable ?? existing?.state === PluginState.ACTIVE,
      progressReporter: options.progressReporter,
      deferRestart: options.deferRestart,
    });
    return manifest;
  }

  async installUploadedPluginArchive(
    filePath: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter } = {},
  ): Promise<IPluginManifest> {
    options.progressReporter?.({
      phase: 'extracting-package',
      message: 'Extracting uploaded plugin package...',
      pluginSlug: 'upload',
    });

    const manifest = await this.discovery.installFromZip(filePath);
    await this.finalizeInstalledPlugin(manifest.slug, options);
    return manifest;
  }

  /**
   * Updates every installed plugin the marketplace has a NEWER version of, then schedules ONE
   * runtime restart at the end — the per-plugin path restarts after each replace, which made
   * updating N plugins cost N restarts. A plugin that fails is reported and skipped; the rest of
   * the batch still lands, and the single restart still happens for whatever was replaced.
   */
  async updateAllFromMarketplace(
    options: { progressReporter?: IPluginInstallProgressReporter } = {},
  ): Promise<{ updated: string[]; failed: { slug: string; error: string }[] }> {
    const catalog = await this.marketplace.fetchCatalog();
    const updates = (catalog || []).filter((entry) => {
      const installed = this.plugins.get(entry.slug);
      return Boolean(installed && VersionComparisonService.isGreater(entry.version, installed.manifest?.version));
    });

    const updated: string[] = [];
    const failed: { slug: string; error: string }[] = [];

    if (!updates.length) {
      options.progressReporter?.({ phase: 'completed', message: 'Every installed plugin is already at its latest marketplace version.', pluginSlug: 'all' });
      return { updated, failed };
    }

    for (const [index, entry] of updates.entries()) {
      // The admin shows this message VERBATIM as the live progress label — lead with the countdown
      // so the operator watches it decrease (7, 6, 5…) instead of guessing how far along it is.
      const remaining = updates.length - index;
      options.progressReporter?.({
        phase: 'updating-plugin',
        message: `${remaining} update${remaining === 1 ? '' : 's'} remaining — updating ${entry.slug} to v${entry.version}...`,
        pluginSlug: entry.slug,
      });
      try {
        await this.installOrUpdateFromMarketplace(entry.slug, {
          progressReporter: options.progressReporter,
          version: entry.version,
          deferRestart: true,
        });
        updated.push(entry.slug);
      } catch (error) {
        failed.push({ slug: entry.slug, error: (error as Error).message });
        options.progressReporter?.({
          phase: 'plugin-failed',
          message: `Update failed for ${entry.slug}: ${(error as Error).message} — continuing with the rest.`,
          pluginSlug: entry.slug,
        });
      }
    }

    if (updated.length && this.restartOwed) {
      this.restartOwed = false;
      options.progressReporter?.({
        phase: 'restart-required',
        message: `All ${updated.length} update(s) installed — restarting the API for the plugin(s) that run inside it...`,
        pluginSlug: 'all',
      });
      this.runtimeRestart.scheduleRestart(`Batch update replaced ${updated.length} plugin(s).`);
    } else if (updated.length) {
      options.progressReporter?.({ phase: 'completed', message: `All ${updated.length} update(s) installed; each plugin's process was replaced in place.`, pluginSlug: 'all' });
    }

    return { updated, failed };
  }

  async finalizeInstalledPlugin(
    slug: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter; deferRestart?: boolean } = {},
  ): Promise<void> {
    const existingPlugin = this.plugins.get(slug);
    const manifestPath = path.join(this.pluginsRoot, slug, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Installed plugin manifest not found for "${slug}".`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as IPluginManifest;
    const pluginPath = path.dirname(manifestPath);
    await this.runPluginMigrations(slug, pluginPath, manifest, options.progressReporter);

    if (existingPlugin && existingPlugin.state !== PluginState.ERROR) {
      const desiredState = options.enable === true
        ? PluginState.ACTIVE
        : options.enable === false
          ? PluginState.INACTIVE
          : existingPlugin.state;

      await this.registry.savePluginState(
        slug,
        desiredState,
        existingPlugin.approvedCapabilities,
        manifest.version,
      );

      // T5: an ISOLATED plugin is its own process — start a new one on the new files and the update is
      // live, with every other plugin and every request in flight untouched. Only a plugin that runs
      // inside the api process still needs the api restarted to load new code.
      if (await this.reloadHost(slug, manifest)) {
        existingPlugin.manifest = manifest;
        options.progressReporter?.({
          phase: 'plugin-reloaded',
          message: `Plugin "${slug}" was replaced and its process restarted on the new code. No API restart needed.`,
          pluginSlug: slug,
        });
        return;
      }

      if (options.deferRestart) {
        this.restartOwed = true;
        // A batch driver replaces several plugins and restarts ONCE at the end — restarting here
        // would kill the API mid-batch and abort every remaining update.
        options.progressReporter?.({
          phase: 'plugin-replaced',
          message: `Plugin "${slug}" was replaced. Restart deferred to the end of the batch.`,
          pluginSlug: slug,
        });
        return;
      }

      options.progressReporter?.({
        phase: 'restart-required',
        message: `Plugin "${slug}" was replaced. Scheduling API restart so the new runtime code is loaded.`,
        pluginSlug: slug,
      });

      this.runtimeRestart.scheduleRestart(`Plugin "${slug}" was replaced on disk.`);
      return;
    }

    options.progressReporter?.({
      phase: 'refreshing-plugin-registry',
      message: `Refreshing plugin registry for "${slug}"...`,
      pluginSlug: slug,
    });
    await this.discoverPlugins();

    if (options.enable) {
      options.progressReporter?.({
        phase: 'enabling-plugin',
        message: `Activating "${slug}"...`,
        pluginSlug: slug,
      });
      await this.enablePlugin(slug);
    }

    options.progressReporter?.({
      phase: 'completed',
      message: `Plugin "${slug}" is ready.`,
      pluginSlug: slug,
    });
  }

  private async runPluginMigrations(
    slug: string,
    pluginPath: string,
    manifest: IPluginManifest,
    progressReporter?: IPluginInstallProgressReporter,
  ): Promise<void> {
    progressReporter?.({
      phase: 'checking-migrations',
      message: `Checking migrations for "${slug}"...`,
      pluginSlug: slug,
    });

    const pluginMigrations = await PluginMigrationLoader.load(slug, pluginPath, manifest.migrations);
    if (pluginMigrations.length === 0) {
      progressReporter?.({
        phase: 'checking-migrations',
        message: `No plugin migrations found for "${slug}".`,
        pluginSlug: slug,
      });
      return;
    }

    await this.migrationManager.migrate(pluginMigrations, progressReporter);
  }
}
