import { DependencyIssueKind } from '@core/plugin/services/enums/dependency-issue-kind.enum';
import { PluginSiteDataReplay } from '@core/plugin/tenant/plugin-site-data-replay';
import { PluginApprovalMode } from '@core/plugin/services/enums/plugin-approval-mode.enum';
import { randomUUID } from 'crypto';
import { Logger } from '@core/logging';
import { PluginArchiveInstallerService } from '@core/plugin/services/installation/plugin-archive-installer-service';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IAtlantisPlugin } from '@core/interfaces/atlantis-plugin.interface';
import { SystemConstants } from '@core/constants/system.constants';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';
import { SchemaManager } from '@core/database/schema-manager';

import { ManifestValidator } from '@core/management/manifest-validator';
import { Seeder } from '@core/database/seeder';
import { PluginFailureIsolationService } from '@core/plugin/services/runtime/plugin-failure-isolation-service';
import { PluginCollectionActivationService } from '@core/plugin/services/plugin-collection-activation-service';
import { PluginRegistrationSecurityService } from '@core/plugin/services/security/plugin-registration-security-service';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginPackageLayout } from '@core/plugin/plugin-package-layout';

import { PluginBootHealthReporter } from '@core/plugin/services/runtime/plugin-boot-health-reporter';
import { PluginSeedRunner } from '@core/plugin/services/runtime/plugin-seed-runner';
import { PluginRegistrationState } from '@core/plugin/services/runtime/plugin-registration-state';
import { PluginTeardownService } from '@core/plugin/services/runtime/plugin-teardown-service';

export class LifecycleService {
  private logger = new Logger({ namespace: 'lifecycle-service' });
  private seeder: Seeder;
  private failureIsolation: PluginFailureIsolationService;
  private activation: PluginCollectionActivationService;
  private bootHealth: PluginBootHealthReporter;
  private seedRunner: PluginSeedRunner;

  private readonly registrationState: PluginRegistrationState;
  private readonly teardown: PluginTeardownService;

  constructor(
    private manager: IPluginManagerInterface,
    private registry: PluginStateService,
    private discovery: DiscoveryService,
    private schemaManager: SchemaManager
  ) {
    this.registrationState = new PluginRegistrationState(this.manager, this.registry, this.logger);
    this.seeder = new Seeder(manager.db);
    this.failureIsolation = new PluginFailureIsolationService(manager, registry, this.logger);
    this.activation = new PluginCollectionActivationService(manager, schemaManager, this.seeder, this.logger);
    this.teardown = new PluginTeardownService(this.manager, this.registry, this.activation, this.logger);
    this.bootHealth = new PluginBootHealthReporter(this.manager, this.logger);
    this.seedRunner = new PluginSeedRunner(this.manager, this.activation);
  }

  /** @inheritdoc — delegated to PluginBootHealthReporter. */
  async reportBootPluginHealth(): Promise<void> {
    return this.bootHealth.reportBootPluginHealth();
  }

  /** @inheritdoc — delegated to PluginSeedRunner. */
  async runSeedsForCurrentSite(): Promise<string[]> {
    return this.seedRunner.runSeedsForCurrentSite();
  }

  /** @inheritdoc — delegated to PluginSeedRunner. */
  async materializeDefaultPagesFinalPass(): Promise<void> {
    return this.seedRunner.materializeDefaultPagesFinalPass();
  }

  async register(plugin: IAtlantisPlugin, pluginPath?: string): Promise<void> {
    const slug = plugin.manifest.slug;
    const existingEntry = this.manager.plugins.get(slug);
    
    // Only throw if the plugin is already registered AND it's not in an error state.
    // If it's in an error state, we want to allow re-registration to attempt recovery.
    if (existingEntry && existingEntry.state !== PluginState.ERROR) {
      throw new Error(`Plugin with slug "${slug}" is already registered.`);
    }

    try {
      ManifestValidator.validate(plugin.manifest);
    } catch (err) {
      throw new Error(`Invalid manifest for "${slug}": ${err}`);
    }

    await PluginRegistrationSecurityService.verify(plugin, pluginPath, this.logger);

    this.discovery.validateDependencies(plugin.manifest, this.manager.plugins);

    const registryData = await this.registry.loadInstalledPluginsState();
    const { state, heldReason, saved } = await this.registrationState.resolve(slug, plugin, registryData);
    const loadedPlugin: ILoadedPlugin = {
      ...plugin,
      instanceId: randomUUID(),
      state: PluginState.INACTIVE,
      path: pluginPath,
      approvedCapabilities: saved?.approvedCapabilities || [],
      healthStatus: heldReason ? PluginRegistryHealth.WARNING : (saved?.healthStatus || PluginRegistryHealth.HEALTHY),
      heldReason
    };

    const hasSavedSandboxConfig = !!saved && Object.prototype.hasOwnProperty.call(saved, 'sandboxConfig') && saved.sandboxConfig !== undefined;
    if (hasSavedSandboxConfig) {
      if (saved!.sandboxConfig === false) {
        loadedPlugin.manifest.sandbox = false;
      } else if (!loadedPlugin.manifest.sandbox || typeof loadedPlugin.manifest.sandbox === 'boolean') {
        loadedPlugin.manifest.sandbox = saved!.sandboxConfig;
      } else {
        loadedPlugin.manifest.sandbox = { ...loadedPlugin.manifest.sandbox, ...saved!.sandboxConfig };
      }
    }

    loadedPlugin.manifest.config = await this.registry.getPluginConfig(slug);
    this.manager.plugins.set(slug, loadedPlugin);

    const isFreshInstall = !saved;
    const savedVersion = saved?.version;
    const isVersionUpdate = !isFreshInstall && !!savedVersion && savedVersion !== plugin.manifest.version;
    const ctx = (this.manager as any).createContext(loadedPlugin);
    // The registry row has to exist BEFORE the hooks run: a plugin that registers a scheduled task or
    // writes its settings from onInit writes a row whose plugin_slug is a foreign key onto this table.
    const createdRegistryRow = await this.registry.ensurePluginRegistryRow(slug, plugin.manifest.version);
    try {
      if (isFreshInstall && loadedPlugin.onInstall) await loadedPlugin.onInstall(ctx);
      if (isVersionUpdate && loadedPlugin.onUpdate && savedVersion) {
        await loadedPlugin.onUpdate(ctx, { oldVersion: savedVersion, newVersion: plugin.manifest.version });
      }
      if (loadedPlugin.onInit) await loadedPlugin.onInit(ctx);
      // ...and again, once per site, with every registration method inert.
      //
      // `onInit` does two jobs: it REGISTERS (global, exactly once — done by the call above) and it
      // sets up DATA (per site). Boot has no site, so the second half was skipped or refused for all
      // of them: seven plugins shipped defaults, backfills and normalisations that ran for nobody.
      // That is a framework problem, not seven plugin problems, so the framework replays the hook
      // rather than asking every plugin author to remember a tenancy call.
      await PluginSiteDataReplay.run(loadedPlugin, ctx, this.manager.db, this.logger);
    } catch (err: any) {
      this.failureIsolation.rollbackPartialRegistration(loadedPlugin);
      await this.failureIsolation.markPluginError(loadedPlugin, err.message);
      const hook = isFreshInstall ? 'onInstall/onInit' : isVersionUpdate ? 'onUpdate/onInit' : 'onInit';
      this.logger.error(`Error during ${hook} for plugin "${slug}": ${err.message}`, err.stack);
      // Undo the row this boot created so the plugin stays a FRESH install and onInstall runs again
      // next time. markPluginError above already recorded the failure for a pre-existing plugin.
      if (createdRegistryRow) await this.registry.removePluginRegistryRow(slug);
      throw new Error(`Plugin "${slug}" failed during ${hook}: ${err.message}`);
    }

    if (state === PluginState.ACTIVE) {
      try {
        await this.enable(slug);
      } catch (err: any) {
        await this.failureIsolation.markPluginError(loadedPlugin, err.message);
        throw err;
      }
      return;
    }

    // A held plugin (capability drift) was already persisted by markPluginHeld with
    // state='inactive' + health_status='warning' + held_reason. Do NOT run the healthy-reset
    // below: savePluginState forces health='healthy' for any non-error state and would clobber
    // the 'warning', collapsing the held signal on the health axis. Keep the in-memory value in
    // sync with what markPluginHeld persisted.
    if (heldReason) {
      loadedPlugin.healthStatus = PluginRegistryHealth.WARNING;
      // Self-heal a stale health axis: markPluginHeld persists 'warning', but a row held before that
      // write path existed (or by a legacy path) may still read 'healthy'. Re-assert so the DB matches.
      if (saved?.healthStatus !== PluginRegistryHealth.WARNING) {
        await this.registry.markPluginHeld(slug, heldReason);
      }
      return;
    }

    // Registration succeeded: clear any stale health-error carried over from a prior
    // failure so a recovered (now inactive) plugin reports healthy. savePluginState
    // persists health='healthy' for any non-error state. (The active path resets these
    // inside enable().)
    loadedPlugin.healthStatus = PluginRegistryHealth.HEALTHY;
    loadedPlugin.error = undefined;
    await this.registry.savePluginState(slug, state, saved ? undefined : (plugin.manifest.capabilities as string[]), plugin.manifest.version);
  }

  async enable(slug: string, options: { force?: boolean, recursive?: boolean } = {}): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found.`);
    if (plugin.state === PluginState.ACTIVE) {
      if (options.force) {
        this.logger.info(`Plugin "${slug}" already active; forcing collection schema sync.`);
        await this.activation.syncPluginCollections(slug);
      }
      return;
    }

    if (!options.force) {
      const issues = this.discovery.checkDependencies(plugin.manifest, this.manager.plugins, { checkActive: true });
      
      if (issues.length > 0) {
        if (options.recursive) {
          for (const issue of issues) {
            if (issue.type === DependencyIssueKind.INACTIVE) {
              this.logger.info(`Recursively enabling dependency "${issue.slug}" for "${slug}"...`);
              await this.enable(issue.slug, options);
            } else if (issue.type === DependencyIssueKind.MISSING) {
              throw new Error(`Dependency "${issue.slug}" is missing and required by "${slug}".`);
            } else if (issue.type === DependencyIssueKind.INCOMPATIBLE) {
              throw new Error(`Incompatible dependency: "${slug}" requires "${issue.slug}" version "${issue.expected}", but found "${issue.actual}".`);
            }
          }
        } else {
          throw new Error(`DEPENDENCY_ISSUES: ${JSON.stringify(issues)}`);
        }
      }
    }

    const ctx = (this.manager as any).createContext(plugin);
    
    try {
      plugin.state = PluginState.LOADING;
      // An isolated plugin's `onEnable` is a forwarding stub (T5): it runs in the plugin's own process.
      if (plugin.onEnable) await plugin.onEnable(ctx);
      await this.activation.autoDiscoverCollections(plugin, ctx);
      await this.activation.syncPluginCollections(slug);
      await this.activation.runSeeds(slug);
      await this.activation.materializeDefaultPages(slug);

      plugin.state = PluginState.ACTIVE;
      plugin.error = undefined;
      // Enabling re-approves capabilities, so any capability-drift hold is resolved: reset the health
      // axis (in-memory + DB via clearPluginHeld) alongside the state.
      plugin.healthStatus = PluginRegistryHealth.HEALTHY;
      plugin.heldReason = undefined;
      const currentCaps = plugin.manifest.capabilities as string[] || [];
      plugin.approvedCapabilities = currentCaps;

      await this.registry.savePluginState(slug, PluginState.ACTIVE, currentCaps, plugin.manifest.version);
      await this.registry.clearPluginHeld(slug);
      await this.registry.writeLog('INFO', `Plugin "${slug}" successfully enabled.`, slug);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.failureIsolation.markPluginError(plugin, message);
      throw error;
    }
  }

  /** @see PluginTeardownService.disable */
  disable(...args: Parameters<PluginTeardownService["disable"]>): ReturnType<PluginTeardownService["disable"]> {
    return this.teardown.disable(...args);
  }

  /** @see PluginTeardownService.delete */
  delete(...args: Parameters<PluginTeardownService["delete"]>): ReturnType<PluginTeardownService["delete"]> {
    return this.teardown.delete(...args);
  }

}