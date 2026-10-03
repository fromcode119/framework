import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IPluginConsentSummary } from '@core/plugin/consent/interfaces/plugin-consent-summary.interface';
import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';
import { PluginConsentRequiredError } from '@core/plugin/consent/plugin-consent-required-error';
import { PluginConsentSet } from '@core/plugin/consent/plugin-consent-set';
import { PluginConsentSummary } from '@core/plugin/consent/plugin-consent-summary';
import { PluginNetworkDeclaration } from '@core/plugin/consent/plugin-network-declaration';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import { PluginTeardownService } from '@core/plugin/services/runtime/plugin-teardown-service';

/**
 * The one place a plugin's approval is checked, granted and withheld.
 *
 * A plugin runs only while everything its manifest asks for (`PluginConsentSet`) is inside its approved
 * set. Enabling with nothing to approve passes; enabling a plugin that asks for more needs the exact
 * list the operator was shown, and anything else is refused with the summary the consent dialog
 * renders. A plugin that grows past its approval while running is stopped and held.
 */
export class PluginApprovalGate {
  constructor(
    private readonly manager: IPluginManagerInterface,
    private readonly registry: PluginStateService,
    private readonly teardown: PluginTeardownService,
    private readonly logger: Logger,
  ) {}

  /** What the consent dialog shows for an installed plugin; `registered` are the collections its code registered. */
  static summaryOf(plugin: ILoadedPlugin, registered: string[] = []): IPluginConsentSummary {
    const declared = (plugin.manifest.admin?.collections || []).map((collection) => String(collection?.slug || '')).filter(Boolean);
    return PluginConsentSummary.of(plugin.manifest, plugin.approvedCapabilities || [], [...declared, ...registered]);
  }

  /**
   * The approved set a plugin starts with at boot. An approval recorded before hosts were part of one
   * held plain `network` — "anything" — so the hosts its manifest now names are carried into it once:
   * that narrows what it may reach, it never widens it. The operator is told which hosts.
   */
  async carryForward(slug: string, manifest: IPluginManifest, approved: string[]): Promise<string[]> {
    const tokens = PluginNetworkDeclaration.tokens(manifest);
    if (!tokens.length || !PluginConsentSet.predatesHostApproval(approved)) return approved;
    const next = [...new Set([...approved, ...tokens])].sort();
    await this.saveApproved(slug, next);
    await this.registry.writeLog('INFO', `Carried "${slug}"'s network approval over to the hosts it declares: ${tokens.join(', ')}`, slug);
    await this.notify(
      `[Atlantis] "${slug}" may now reach only the hosts it declares`,
      `"${slug}" was approved to reach the internet before plugins declared their hosts. It is now limited to: ${tokens.map((token) => token.replace(PluginNetworkDeclaration.HOST_TOKEN_PREFIX, '')).join(', ')}. Review it in Plugins.`,
    );
    return next;
  }

  /**
   * Passes when the plugin's approval covers its manifest. Otherwise `approve` must be exactly what it
   * asks for now; that list becomes its approval. Refused with the consent summary when it is not.
   */
  async ensureApproved(plugin: ILoadedPlugin, approve?: readonly string[]): Promise<void> {
    const manifest = plugin.manifest;
    if (PluginConsentSet.covers(manifest, plugin.approvedCapabilities)) return;
    if (!approve || !PluginConsentSet.matches(manifest, approve)) {
      throw new PluginConsentRequiredError(PluginApprovalGate.summaryOf(plugin));
    }
    plugin.approvedCapabilities = PluginConsentSet.of(manifest);
    await this.saveApproved(manifest.slug, plugin.approvedCapabilities);
    await this.registry.writeLog('INFO', `Approved "${manifest.slug}": ${plugin.approvedCapabilities.join(', ')}`, manifest.slug);
  }

  /**
   * New files are in place (a hot update, a Sources build, an upload). When their manifest asks for more
   * than was approved, the plugin is stopped and held, and its registration hooks wait for the approval.
   * True when it was held.
   */
  async holdIfUnapproved(slug: string, manifest: IPluginManifest): Promise<boolean> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin) return false;
    const approved = await this.carryForward(slug, manifest, plugin.approvedCapabilities || []);
    plugin.approvedCapabilities = approved;
    if (PluginConsentSet.covers(manifest, approved)) return false;
    const savedVersion = plugin.manifest.version;
    plugin.manifest = manifest;
    plugin.registrationDeferred ??= { isFreshInstall: false, savedVersion };
    await this.hold(slug, approved.length ? PluginHeldReason.CAPABILITY_DRIFT : PluginHeldReason.AWAITING_APPROVAL);
    return true;
  }

  /**
   * Stops a plugin that asks for more than it was approved for, and marks it held so the console shows
   * the approval it waits on. Active plugins that depend on it answer as if it were missing.
   */
  async hold(slug: string, reason: PluginHeldReason): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin) return;
    if (plugin.state === PluginState.ACTIVE) await this.teardown.disable(slug, { ignoreDependents: true });
    plugin.state = PluginState.INACTIVE;
    plugin.heldReason = reason;
    plugin.healthStatus = PluginRegistryHealth.WARNING;
    await this.registry.markPluginHeld(slug, reason);
    const missing = PluginConsentSet.missing(plugin.manifest, plugin.approvedCapabilities);
    this.logger.warn(`Plugin "${slug}" HELD for approval: it asks for ${missing.join(', ')}.`);
    await this.notify(
      `[Atlantis] "${slug}" is waiting for your approval`,
      `"${slug}" asks for ${missing.join(', ')}, which nobody approved. It stays off until an admin approves it in Plugins.`,
    );
  }

  /** Records what is approved and nothing else: `savePluginState` would also reset its health, clearing a hold. */
  private async saveApproved(slug: string, approved: string[]): Promise<void> {
    await this.manager.db.update(SystemConstants.TABLE.PLUGINS, { slug: slug.toLowerCase() }, { capabilities: JSON.stringify(approved), updated_at: new Date() });
  }

  private async notify(subject: string, text: string): Promise<void> {
    try {
      await NotificationsContextProxy.createNotificationsProxy(this.manager, 'core').notifyAdmins({ subject, text });
    } catch {
      // Best effort: the hold itself is recorded, and the console shows it whether or not mail goes out.
    }
  }
}
