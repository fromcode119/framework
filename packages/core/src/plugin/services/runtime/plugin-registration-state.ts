import { NotificationsContextProxy } from '@core/plugin/context/notifications';
import { PluginApprovalMode } from '@core/plugin/services/enums/plugin-approval-mode.enum';
import { PluginBootHealthReporter } from '@core/plugin/services/runtime/plugin-boot-health-reporter';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import type { IFromcodePlugin } from '@core/interfaces/fromcode-plugin.interface';

/**
 * What state a plugin should come back in, given what the registry saved and what the plugin now
 * declares.
 *
 * The decisions this makes, each of which was a real incident:
 *
 *   A BUNDLED extension ships inside the image and is part of the product, not an operator's choice,
 *   so it runs from the first boot whatever the plugins table says. Without that, the framework's own
 *   screens were one forgotten toggle away from missing.
 *
 *   A row persisted as `state: 'error'` is LEGACY. Failures now flip health_status and preserve the
 *   desired state, so a plugin recovers to exactly where it was; an old error row is recovered
 *   conservatively to inactive rather than guessed at.
 *
 *   A HELD plugin stays visibly held across reboots. A plugin held for capability drift is saved
 *   inactive with a reason; the drift gate is skipped on the next boot because the state is no longer
 *   active, so without rehydrating the hold it would look like a plain inactive plugin and the signal
 *   would vanish until somebody re-approved it.
 *
 * Split out of `LifecycleService.register()`, which was a single 195-line method.
 */
export class PluginRegistrationState {
  constructor(
    private readonly manager: any,
    private readonly registry: any,
    private readonly logger: any,
  ) {}

  /** Resolve the state and any held reason for `slug`, applying every rule above in order. */
  async resolve(
    slug: string,
    plugin: IFromcodePlugin,
    registryData: Record<string, any>,
  ): Promise<{ state: PluginState; heldReason: PluginHeldReason | undefined; saved: any }> {
    const normSlug = slug.toLowerCase();
    const saved = registryData[normSlug];
    let state: PluginState = saved?.state || PluginState.INACTIVE;

    // A BUNDLED extension is part of the product, not an operator's choice: it ships inside the
    // image and runs from the first boot, whatever (if anything) the plugins table says about it.
    // Without this, the framework's own screens would be one forgotten toggle away from missing.
    if (plugin.manifest?.bundled === true) {
      state = PluginState.ACTIVE;
    }

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

    /**
     * The capability gate exists because a plugin that quietly grows new powers between versions is
     * how a supply-chain compromise looks. A BUNDLED extension has no such supply chain: it is built
     * from this repository into this image, so its capabilities arrive with the upgrade an operator
     * deliberately performed. Holding it would make the framework's own screens vanish on upgrade
     * pending a re-approval nobody could have anticipated — which is exactly what happened when the
     * build server gained `i18n`.
     */
    const isBundled = plugin.manifest?.bundled === true;
    if (isBundled) {
      heldReason = undefined;
      await this.registry.savePluginState(
        slug,
        PluginState.ACTIVE,
        (plugin.manifest.capabilities as string[]) || [],
        plugin.manifest.version,
      );
    }

    if (state === PluginState.ACTIVE && !isBundled) {
      const diff = PluginBootHealthReporter.computeCapabilityDiff(
        (plugin.manifest.capabilities as string[]) || [],
        saved?.approvedCapabilities || [],
      );
      if (diff.changed) {
        const action = PluginBootHealthReporter.resolveDriftAction(slug, Boolean(saved?.signatureVerified));
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
    return { state, heldReason, saved };
  }
}
