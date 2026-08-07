import { DependencyIssueKind } from '@core/plugin/services/enums/dependency-issue-kind.enum';
import { PluginApprovalMode } from '@core/plugin/services/enums/plugin-approval-mode.enum';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@core/logging';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IFromcodePlugin } from '@core/interfaces/fromcode-plugin.interface';
import { SystemConstants } from '@core/constants/system.constants';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';
import { PluginStateService } from '@core/plugin/services/plugin-state-service';
import { DiscoveryService } from '@core/plugin/services/discovery-service';
import { SchemaManager } from '@core/database/schema-manager';

import { ManifestValidator } from '@core/management/manifest';
import { SandboxManager } from '@core/security/sandbox-manager';
import { Seeder } from '@core/database/seeder';
import { PluginFailureIsolationService } from '@core/plugin/services/plugin-failure-isolation-service';
import { PluginCollectionActivationService } from '@core/plugin/services/plugin-collection-activation-service';
import { PluginRegistrationSecurityService } from '@core/plugin/services/plugin-registration-security-service';
import { PluginCapabilityApprovalPolicy } from '@core/plugin/services/plugin-capability-approval-policy';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
import { PluginHealthNotificationTemplateService } from '@core/plugin/services/plugin-health-notification-template-service';
import type { IPluginHealthNotificationData } from '@core/plugin/services/interfaces/plugin-health-notification-data.interface';
import { PluginHealthReportService } from '@core/plugin/services/plugin-health-report-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginPackageLayout } from '@core/plugin/plugin-package-layout';

export class LifecycleService {
  private logger = new Logger({ namespace: 'lifecycle-service' });
  private sandbox?: SandboxManager;
  private seeder: Seeder;
  private failureIsolation: PluginFailureIsolationService;
  private activation: PluginCollectionActivationService;

  constructor(
    private manager: IPluginManagerInterface,
    private registry: PluginStateService,
    private discovery: DiscoveryService,
    private schemaManager: SchemaManager
  ) {
    this.seeder = new Seeder(manager.db);
    this.failureIsolation = new PluginFailureIsolationService(manager, registry, this.logger);
    this.activation = new PluginCollectionActivationService(manager, schemaManager, this.seeder, this.logger);
    try {
      this.sandbox = new SandboxManager();
    } catch (e) {
      this.logger.warn('SandboxManager failed to initialize (isolated-vm might not be supported in this environment)');
    }
  }

  /** Pure set-diff of manifest vs approved capabilities. Order-independent; used by the held gate. */
  static computeCapabilityDiff(current: string[], approved: string[]): { added: string[]; removed: string[]; changed: boolean } {
    const cur = new Set(current || []);
    const app = new Set(approved || []);
    const added = [...cur].filter((c) => !app.has(c)).sort();
    const removed = [...app].filter((c) => !cur.has(c)).sort();
    return { added, removed, changed: added.length > 0 || removed.length > 0 };
  }

  /** Decide what to do when a plugin's capabilities drifted from approval: 'auto-approve' (trusted +
   *  opt-in) or 'hold'. Pure wrapper over PluginCapabilityApprovalPolicy for testability. */
  static resolveDriftAction(slug: string, signatureVerified: boolean): PluginApprovalMode {
    return PluginCapabilityApprovalPolicy.shouldAutoApprove(slug, signatureVerified) ? PluginApprovalMode.AUTO_APPROVE : PluginApprovalMode.HOLD;
  }

  /**
   * Collect the held/errored plugins as DATA for the admin alert, or null when everything is healthy.
   * Deliberately returns no markup or copy — `PluginHealthNotificationTemplateService` owns those via
   * Handlebars template files (repo rule: code computes data, template files own the rendering).
   */
  static summarizeHeldPlugins(plugins: Map<string, ILoadedPlugin>): IPluginHealthNotificationData | null {
    const flagged = [...plugins.values()].filter(
      (p) => p.healthStatus === PluginRegistryHealth.WARNING || p.healthStatus === PluginRegistryHealth.ERROR || p.state === PluginState.ERROR,
    );
    if (!flagged.length) return null;

    return {
      count: flagged.length,
      plugins: flagged.map((p) => {
        const isError = p.state === PluginState.ERROR || p.healthStatus === PluginRegistryHealth.ERROR;
        // Pass raw values through — the fallback WORDING ("held", "failed to register") is copy and
        // lives in the template, not here.
        return {
          slug: p.manifest?.slug,
          held: !isError,
          reason: p.heldReason,
          error: p.error,
        };
      }),
    };
  }

  /** After a discovery pass, alert admins ONCE if any plugin is held/errored. Best-effort, never throws. */
  async reportBootPluginHealth(): Promise<void> {
    try {
      const report = PluginHealthReportService.buildReport(
        [...this.manager.plugins.values()].map((p) => ({
          slug: p.manifest.slug, state: p.state, healthStatus: p.healthStatus, heldReason: p.heldReason,
          error: p.error, manifestCapabilities: (p.manifest.capabilities as string[]) || [], approvedCapabilities: p.approvedCapabilities || [],
        })),
      );
      this.logger.info(`[plugin-health] ${report.counts.active} active, ${report.counts.held} held, ${report.counts.error} error, ${report.counts.inactive} inactive`);
      const summary = LifecycleService.summarizeHeldPlugins(this.manager.plugins);
      if (!summary) return;
      const message = PluginHealthNotificationTemplateService.render(summary);
      const notifications = NotificationsContextProxy.createNotificationsProxy(this.manager, 'core');
      await notifications.notifyAdmins({ subject: message.subject, text: message.text, html: message.html });
      this.logger.warn(message.subject);
    } catch (err) {
      this.logger.error('reportBootPluginHealth failed', err as any);
    }
  }

  public async getSandboxStats() {
    return this.sandbox ? await this.sandbox.getStats() : null;
  }

  /**
   * Final default-page materialization pass, run by the discovery coordinator once EVERY plugin in the boot
   * set is registered. The per-plugin pass inside {@link register} can execute before the plugin that owns the
   * `pages` collection (CMS) is registered — it then skips ("no registered page collection available") and
   * required contract pages never materialize. This pass guarantees the pages collection is present.
   */
  public async materializeDefaultPagesFinalPass(): Promise<void> {
    await this.activation.materializeDefaultPages();
  }

  async register(plugin: IFromcodePlugin, pluginPath?: string): Promise<void> {
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
    const normSlug = slug.toLowerCase();
    const saved = registryData[normSlug];
    let state: PluginState = saved?.state || PluginState.INACTIVE;

    // Failures now only flip health_status to 'error' and PRESERVE the desired `state`
    // (see PluginStateService.markPluginHealthError), so saved.state is normally a real
    // 'active' | 'inactive' value and the plugin recovers to exactly where it was: an
    // active plugin re-enables below, an inactive one stays inactive. This branch is a
    // defensive fallback for legacy rows persisted with state='error' before that change —
    // recover them conservatively to 'inactive' rather than guess. A tampered/malicious
    // plugin never reaches here (the integrity check above throws first).
    if (state === PluginState.ERROR) {
      state = PluginState.INACTIVE;
    }

    // Rehydrate a persisted hold so it STAYS visibly held across reboots: a plugin held for capability
    // drift is saved inactive + held_reason. On the next boot the drift gate below is skipped (state is
    // no longer 'active'), so without this the in-memory plugin would look like a plain inactive one and
    // the held signal (and its 'warning' health) would vanish until re-approved. Only rehydrate for
    // non-active rows; enable()/clearPluginHeld nulls held_reason on re-approval so it won't re-apply.
    let heldReason: PluginHeldReason | undefined = state !== PluginState.ACTIVE ? saved?.heldReason : undefined;
    if (state === PluginState.ACTIVE) {
      const diff = LifecycleService.computeCapabilityDiff(
        (plugin.manifest.capabilities as string[]) || [],
        saved?.approvedCapabilities || [],
      );
      if (diff.changed) {
        const action = LifecycleService.resolveDriftAction(slug, Boolean(saved?.signatureVerified));
        if (action === PluginApprovalMode.AUTO_APPROVE) {
          const currentCaps = (plugin.manifest.capabilities as string[]) || [];
          this.logger.warn(
            `Plugin "${slug}" AUTO-APPROVED capability change (added: [${diff.added.join(', ')}], removed: [${diff.removed.join(', ')}]) — AUTO_APPROVE_PLUGIN_CAPABILITIES is on and the plugin is trusted.`,
          );
          await this.registry.savePluginState(slug, PluginState.ACTIVE, currentCaps, plugin.manifest.version);
          await this.registry.writeLog('WARN', `Auto-approved capability change for "${slug}": +[${diff.added.join(', ')}] -[${diff.removed.join(', ')}]`, slug);
          try {
            const notifications = NotificationsContextProxy.createNotificationsProxy(this.manager, 'core');
            await notifications.notifyAdmins({
              subject: `[Fromcode] Auto-approved new capabilities for "${slug}"`,
              text: `"${slug}" gained capabilities [${diff.added.join(', ')}] and was auto-approved (AUTO_APPROVE_PLUGIN_CAPABILITIES on, plugin trusted). Review in Admin -> Plugins if unexpected.`,
            });
          } catch { /* best-effort */ }
          // state stays 'active' -> the existing active path enables it below.
        } else {
          // Capability set changed since it was last approved. Do NOT silently deactivate (that looked
          // like a deliberate disable and caused a prod outage). Hold it: inactive + health 'warning' +
          // reason, so the admin sees it and one-click re-approves (enable() advances the approved set).
          state = PluginState.INACTIVE;
          heldReason = PluginHeldReason.CAPABILITY_DRIFT;
          this.logger.warn(
            `Plugin "${slug}" HELD: capabilities changed since approval (added: [${diff.added.join(', ')}], removed: [${diff.removed.join(', ')}]). Re-approve to activate.`,
          );
          await this.registry.markPluginHeld(slug, heldReason);
        }
      }
    }

    const loadedPlugin: ILoadedPlugin = {
      ...plugin,
      instanceId: uuidv4(),
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
    try {
      if (isFreshInstall && loadedPlugin.onInstall) await loadedPlugin.onInstall(ctx);
      if (isVersionUpdate && loadedPlugin.onUpdate && savedVersion) {
        await loadedPlugin.onUpdate(ctx, { oldVersion: savedVersion, newVersion: plugin.manifest.version });
      }
      if (loadedPlugin.onInit) await loadedPlugin.onInit(ctx);
    } catch (err: any) {
      this.failureIsolation.rollbackPartialRegistration(loadedPlugin);
      await this.failureIsolation.markPluginError(loadedPlugin, err.message);
      const hook = isFreshInstall ? 'onInstall/onInit' : isVersionUpdate ? 'onUpdate/onInit' : 'onInit';
      this.logger.error(`Error during ${hook} for plugin "${slug}": ${err.message}`, err.stack);
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
      if (plugin.isSandboxed && plugin.entryPath && this.sandbox) {
        this.logger.info(`Initializing sandbox for "${slug}"...`);
        await this.sandbox.initPluginContext(slug, ctx, plugin.manifest);
        if (plugin.onEnable) await plugin.onEnable(ctx);
      } else {
        if (plugin.onEnable) await plugin.onEnable(ctx);
      }
      await this.activation.autoDiscoverCollections(plugin, ctx);
      await this.activation.syncPluginCollections(slug);
      await this.activation.runSeeds(slug);
      await this.activation.materializeDefaultPages();

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

  async disable(slug: string, options: { persistState?: boolean } = {}): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin || plugin.state !== PluginState.ACTIVE) return;

    // Check if any active plugins depend on this one
    const activeDependents = Array.from(this.manager.plugins.values()).filter(p => 
      p.state === PluginState.ACTIVE && 
      p.manifest.dependencies && 
      p.manifest.dependencies[slug]
    );
    
    if (activeDependents.length > 0) {
      const dependentNames = activeDependents.map(p => p.manifest.slug).join(', ');
      throw new Error(
        `Cannot disable plugin "${slug}" because it is required by active plugins: ${dependentNames}. ` +
        `Please disable those plugins first.`
      );
    }

    const ctx = (this.manager as any).createContext(plugin);
    try {
      if (plugin.isSandboxed && this.sandbox) {
        this.sandbox.disposePluginContext(slug);
      } else {
        if (plugin.onDisable) await plugin.onDisable(ctx);
      }
      plugin.state = PluginState.INACTIVE;
      this.manager.middlewares.unregisterByPlugin(slug);
      if (options.persistState !== false) {
        await this.registry.savePluginState(slug, PluginState.INACTIVE, undefined, plugin.manifest.version);
        await this.registry.writeLog('INFO', `Plugin "${slug}" disabled.`, slug);
      }
    } catch (error) {
      this.logger.error(`Error disabling plugin "${slug}": ${error}`);
    }
  }

  async delete(slug: string): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (plugin) {
      const dependents = Array.from(this.manager.plugins.values()).filter(p =>
        p.manifest.dependencies && p.manifest.dependencies[slug]
      );
      if (dependents.length > 0) {
        throw new Error(`Cannot delete plugin "${slug}" because it is required by: ${dependents.map(p => p.manifest.slug).join(', ')}`);
      }
      if (plugin.state === PluginState.ACTIVE) await this.disable(slug);

      if (plugin.onUninstall) {
        const ctx = (this.manager as any).createContext(plugin);
        try {
          await plugin.onUninstall(ctx);
        } catch (err: any) {
          this.logger.error(`Error during onUninstall for plugin "${slug}": ${err.message}`);
        }
      }
    }

    await this.manager.db.delete(SystemConstants.TABLE.PLUGINS, { slug });
    const pluginPath = plugin?.path;
    this.manager.plugins.delete(slug);
    this.manager.middlewares.unregisterByPlugin(slug);

    this.activation.cleanupAfterDelete(slug, pluginPath, plugin?.manifest.main || PluginPackageLayout.SERVER_ENTRY);
  }
}
