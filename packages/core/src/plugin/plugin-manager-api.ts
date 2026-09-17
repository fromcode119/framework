import type { IFromcodePlugin } from '@core/interfaces/fromcode-plugin.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginInstallProgressReporter } from '@core/plugin/interfaces/plugin-install-progress-reporter.interface';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import type { IScaffoldPluginInput } from '@core/plugin/services/interfaces/scaffold-plugin-input.interface';
import type { IScaffoldPluginResult } from '@core/plugin/services/interfaces/scaffold-plugin-result.interface';
import type { ThemeManager } from '@core/theme/theme-manager';
import { PluginContext } from '@core/plugin/plugin-context';
import { PluginContextFactory } from '@core/plugin/context';
import { PluginManagerExtensions } from '@core/plugin/plugin-manager-extensions';
/**
 * The surface everything else calls the plugin manager THROUGH.
 *
 * Almost every method here is one line, and that is the shape it should be: the manager is a facade
 * over a dozen services, and this is the facade. The value is that callers — the api, the admin,
 * plugins themselves — depend on one stable name each instead of on which service happens to own the
 * behaviour this week.
 *
 * One half of `PluginManager` (`extends PluginManagerExtensions, PluginManagerApi`).
 */
export abstract class PluginManagerApi extends PluginManagerExtensions {
  /**
   * Materialize the default pages of every plugin the CURRENT site runs (call inside that site's
   * tenant scope). This is what gives a newly created site its /shop, /login and friends — the boot
   * pass runs untenanted and cannot write a site's pages.
   */
  async materializeDefaultPages(): Promise<void> { return this.lifecycle.materializeDefaultPagesFinalPass(); }
  /** Every active plugin's seed data, for the site currently in scope. */
  async runPluginSeedsForCurrentSite(): Promise<string[]> { return this.lifecycle.runSeedsForCurrentSite(); }
  async enable(slug: string, options: { force?: boolean, recursive?: boolean } = {}) { return this.lifecycle.enable(slug, options); }
  async disable(slug: string, options: { persistState?: boolean } = {}) { return this.lifecycle.disable(slug, options); }
  async delete(slug: string) { return this.lifecycle.delete(slug); }
  async register(plugin: IFromcodePlugin, path?: string) { return this.lifecycle.register(plugin, path); }

  async scaffoldPlugin(input: IScaffoldPluginInput): Promise<IScaffoldPluginResult> {
    return this.scaffold.scaffoldPlugin(input);
  }

    async writeLog(level: string, message: string, pluginSlug?: string, context?: any) {
    await this.registry.writeLog(level, message, pluginSlug, context);
    this.telemetry.notifyOnCriticalLog(level, message, pluginSlug, context).catch((error: any) => {
      this.logger.warn("Email telemetry alert dispatch failed: " + (error?.message || error));
    });
  }

  async sendWeeklyEmailTelemetryDigest(): Promise<void> {
    return this.telemetry.sendWeeklyEmailTelemetryDigest();
  }

  public async sendTestEmailTelemetry(triggeredBy?: { id?: string | number; email?: string; roles?: string[] }): Promise<{ sent: boolean; recipientsCount: number }> {
    return this.telemetry.sendTestEmailTelemetry(triggeredBy);
  }

    async savePluginConfig(slug: string, config: any) {
    await this.runtimeState.savePluginConfig(slug, config);
  }

  async saveSandboxConfig(slug: string, config: any) {
    await this.runtimeState.saveSandboxConfig(slug, config);
  }

  public getHeadInjections(slug: string): any[] {
    return this.runtimeState.getHeadInjections(slug);
  }

  getCollections() {
    return this.runtimeState.getCollections();
  }

  getCollection(slug: string) {
    return this.runtimeState.getCollection(slug);
  }

  public registerPluginSettings(pluginSlug: string, schema: any): void {
    this.runtimeState.registerPluginSettings(pluginSlug, schema);
  }

  public getPluginSettings(pluginSlug: string): any | undefined {
    return this.runtimeState.getPluginSettings(pluginSlug);
  }

  public getAllPluginSettings(): Map<string, any> {
    return this.runtimeState.getAllPluginSettings();
  }

  public async getPublicFrontendPluginSettings(): Promise<Record<string, Record<string, any>>> {
    return this.query.getPublicFrontendPluginSettings((slug: string) => this.getPluginSettings(slug));
  }

  async installFromZip(filePath: string, pluginsRoot?: string): Promise<IPluginManifest> {
    return this.discovery.installFromZip(filePath);
  }

  async finalizeInstalledPlugin(
    slug: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter } = {},
  ): Promise<void> {
    await this.installation.finalizeInstalledPlugin(slug, options);
  }

  async disableWithError(slug: string, message: string): Promise<void> {
    await this.runtimeState.disableWithError(slug);
  }

  public async getSecuritySummary() {
    return this.adminRuntime.getSecuritySummary();
  }

  /** Returns plugins in topological order based on their dependencies. */
  public getSortedPlugins(pluginsToSort?: ILoadedPlugin[]): ILoadedPlugin[] {
    return this.query.getSortedPlugins(pluginsToSort);
  }

  getRuntimeModules() { return this.adminRuntime.getRuntimeModules(); }
  async getAdminMetadata() {
    return this.adminRuntime.getAdminMetadata(() => this.getSortedPlugins());
  }

  getImportMap() {
    return this.adminRuntime.getImportMap();
  }

  getPlugins(): ILoadedPlugin[] { return Array.from(this.plugins.values()); }
  setAuth(auth: any) { this.auth = auth; }
  /**
   * The API boots the ThemeManager separately (it needs the manager's db) and MUST hand it back before
   * `discoverPlugins()`: plugins read `context.theme` in their onInit (the forms plugin builds its default
   * contact form from the theme's `contactFormDefaults` there). This hand-off was missing for every boot,
   * so `context.theme` was `{}` for every plugin and every theme-declared plugin default was ignored.
   */
  setThemeManager(themeManager: ThemeManager) { this.themeManager = themeManager; }
  setApiHost(host: any) { this.apiHost = host; }

  emit(event: string, payload: any) { 
    this.hooks.emit(event, payload);
  }

  async close() {
    return this.shutdownService.close();
  }

  /**
   * Physical tables belonging to collections declared `system: true` — framework configuration,
   * which is never tenant-scoped regardless of what the table is called.
   *
   * PUBLIC because adoption must ask the same question the boot sweep does. Two copies of "which
   * tables are platform configuration" would eventually disagree, and the disagreement would show
   * up as a table scoped by one path and not the other.
   */
  systemCollectionTables(): Set<string> {
    const tables = new Set<string>();
    for (const [, entry] of this.registeredCollections) {
      const collection: any = entry.collection;
      if (collection?.system !== true) continue;
      for (const name of [collection.tableName, collection.slug]) {
        if (name) tables.add(String(name).toLowerCase());
      }
    }
    return tables;
  }
}
