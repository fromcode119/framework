import type { IPluginInstallProgressReporter } from '@core/plugin/interfaces/plugin-install-progress-reporter.interface';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import { PluginManagerQueryService } from '@core/plugin/services/runtime/plugin-manager-query-service';
import { PluginManagerState } from '@core/plugin/plugin-manager-state';
import { StorefrontRendererRefreshService } from '@core/management/storefront-renderer-refresh-service';

/**
 * Getting an extension ONTO this deployment: from the marketplace, an uploaded archive, or a
 * directory — and taking the whole host down again.
 *
 * Plugins, themes and appearances all arrive the same three ways, so the installers for the other
 * two are INJECTED (`setThemeArchiveInstaller` and friends) rather than imported. Core must not
 * import the theme layer to install a theme; whoever owns that layer hands the capability in.
 *
 * One half of `PluginManager` (`extends PluginManagerExtensions, PluginManagerApi`).
 */
export abstract class PluginManagerExtensions extends PluginManagerState {
  async updatePlugin(slug: string, pkg?: any): Promise<void> {
    await this.installOrUpdateFromMarketplace(slug);
  }

  async installOrUpdateFromMarketplace(
    slug: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter; version?: string } = {},
  ): Promise<IPluginManifest> {
    const manifest = await this.installation.installOrUpdateFromMarketplace(slug, options);
    await this.refreshStorefrontRenderer(`plugin "${slug}" installed/updated`);
    return manifest;
  }

  /** Update every installed plugin with a newer marketplace version — ONE restart at the end. */
  async updateAllFromMarketplace(
    options: { progressReporter?: IPluginInstallProgressReporter } = {},
  ): Promise<{ updated: string[]; failed: { slug: string; error: string }[] }> {
    const outcome = await this.installation.updateAllFromMarketplace(options);
    // ONE refresh for the whole batch, and only when something actually changed on disk.
    if (outcome.updated.length) {
      await this.refreshStorefrontRenderer(`plugins updated (${outcome.updated.join(', ')})`);
    }
    return outcome;
  }

  async installUploadedPluginArchive(
    filePath: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter } = {},
  ): Promise<IPluginManifest> {
    const manifest = await this.installation.installUploadedPluginArchive(filePath, options);
    await this.refreshStorefrontRenderer(`plugin "${manifest.slug}" installed from an archive`);
    return manifest;
  }

  /** Installs a plugin from a package directory this installation built. */
  async installPluginDirectory(
    packageDir: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter } = {},
  ): Promise<IPluginManifest> {
    const manifest = await this.installation.installPluginDirectory(packageDir, options);
    await this.refreshStorefrontRenderer(`plugin "${manifest.slug}" installed from a built package`);
    return manifest;
  }

  /**
   * The storefront server-renders each plugin's `ui-ssr` bundle and holds it for the life of its
   * process, so a plugin whose files just changed keeps rendering from the previous copy until the
   * renderer restarts — silently, as empty values rather than an error. Same contract as the theme
   * side; never fatal (see {@link StorefrontRendererRefreshService}).
   */
  private async refreshStorefrontRenderer(reason: string): Promise<void> {
    await StorefrontRendererRefreshService.afterExtensionsChanged(reason, this.logger);
  }

  setThemeArchiveInstaller(installer: (filePath: string, options?: { activate?: boolean }) => Promise<any>): void {
    this.archiveInstaller.setThemeArchiveInstaller(installer);
  }

  setCoreArchiveInstaller(installer: (filePath: string) => Promise<any>): void {
    this.archiveInstaller.setCoreArchiveInstaller(installer);
  }

  setThemeDirectoryInstaller(installer: (packageDir: string, options?: { activate?: boolean }) => Promise<any>): void {
    this.archiveInstaller.setThemeDirectoryInstaller(installer);
  }

  setAppearanceDirectoryInstaller(installer: (packageDir: string) => Promise<any>): void {
    this.archiveInstaller.setAppearanceDirectoryInstaller(installer);
  }

  /**
   * Installs a package DIRECTORY this installation built, rather than an archive.
   *
   * The storefront refresh mirrors the archive entry point: PLUGIN scope only, because a theme is
   * routed to the theme manager which refreshes for itself.
   */
  async installExtensionDirectory(
    packageDir: string,
    type: ExtensionScope,
    options: { enable?: boolean; activate?: boolean } = {},
  ): Promise<any> {
    const outcome = await this.archiveInstaller.installExtensionDirectory(packageDir, type, options);
    if (ExtensionScope.find(type) === ExtensionScope.PLUGIN) {
      await this.refreshStorefrontRenderer('a built plugin package was installed');
    }
    return outcome;
  }

  async installExtensionArchive(
    filePath: string,
    type: ExtensionScope,
    options: { enable?: boolean; activate?: boolean } = {},
  ): Promise<any> {
    const outcome = await this.archiveInstaller.installExtensionArchive(filePath, type, options);
    // PLUGIN scope only: a theme archive is routed to the theme manager, which performs its own
    // refresh — refreshing here as well would restart the storefront twice for one install.
    if (ExtensionScope.resolve(type) === ExtensionScope.PLUGIN) {
      await this.refreshStorefrontRenderer('a plugin archive was installed');
    }
    return outcome;
  }

  /**
   * Whether an extension of this scope is already installed. See PluginManagerQueryService.
   *
   * Asked before a build installs itself: putting a package where none was is a different act from
   * replacing code that is currently serving a site, and only the second needs a separate consent.
   */
  async isExtensionInstalled(slug: string, type: ExtensionScope): Promise<boolean> {
    return this.query.isExtensionInstalled(slug, type, this.themeManager);
  }

  /** Which version is installed, or null when none is. See the query service for why it reads disk. */
  async installedExtensionVersion(slug: string, type: ExtensionScope): Promise<string | null> {
    return this.query.installedExtensionVersion(slug, type, this.themeManager);
  }

  async shutdown() {
    return this.shutdownService.shutdown();
  }

  // Delegate Lifecycle
}
