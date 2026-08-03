import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
import * as fs from 'fs';
import * as path from 'path';
import { BackupService } from '@core/management/backup-service';
import { PluginMigrationLoader } from '@core/database/plugin-migration-loader';
import { Logger } from '@core/logging';
import { MigrationManager } from '@core/database/migration-manager';
import { DiscoveryService } from '@core/plugin/services/discovery-service';
import { MarketplaceCatalogService } from '@core/marketplace/marketplace-catalog-service';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';
import type { IPluginInstallProgressReporter } from '@core/plugin/interfaces/plugin-install-progress-reporter.interface';
import { PluginStateService } from '@core/plugin/services/plugin-state-service';
import { PluginRuntimeRestartService } from '@core/plugin/services/plugin-runtime-restart-service';
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
  ) {}

  async installOrUpdateFromMarketplace(
    slug: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter; version?: string } = {},
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

  async finalizeInstalledPlugin(
    slug: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter } = {},
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
