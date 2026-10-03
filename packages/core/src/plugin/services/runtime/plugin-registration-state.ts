import { NotificationsContextProxy } from '@core/plugin/context/notifications';
import { PluginApprovalMode } from '@core/plugin/services/enums/plugin-approval-mode.enum';
import { PluginBootHealthReporter } from '@core/plugin/services/runtime/plugin-boot-health-reporter';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import type { IAtlantisPlugin } from '@core/interfaces/atlantis-plugin.interface';
import { PluginConsentSet } from '@core/plugin/consent/plugin-consent-set';
import type { PluginApprovalGate } from '@core/plugin/services/runtime/plugin-approval-gate';

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
    private readonly gate: PluginApprovalGate,
  ) {}

  /** Resolve the state and any held reason for `slug`, applying every rule above in order. */
  async resolve(
    slug: string,
    plugin: IAtlantisPlugin,
    registryData: Record<string, any>,
  ): Promise<{ state: PluginState; heldReason: PluginHeldReason | undefined; saved: any; approved: string[] }> {
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
      const approved = PluginConsentSet.of(plugin.manifest);
      await this.registry.savePluginState(slug, PluginState.ACTIVE, approved, plugin.manifest.version);
      return { state, heldReason, saved, approved };
    }

    let approved: string[] = saved ? await this.gate.carryForward(slug, plugin.manifest, saved.approvedCapabilities || []) : [];
    const missing = PluginConsentSet.missing(plugin.manifest, approved);
    if (state === PluginState.ACTIVE && missing.length) {
      const action = PluginBootHealthReporter.resolveDriftAction(slug, Boolean(saved?.signatureVerified));
      if (action === PluginApprovalMode.AUTO_APPROVE) {
        approved = PluginConsentSet.of(plugin.manifest);
        this.logger.warn(`Plugin "${slug}" AUTO-APPROVED [${missing.join(', ')}] — AUTO_APPROVE_PLUGIN_CAPABILITIES is on and the plugin is trusted.`);
        await this.registry.savePluginState(slug, PluginState.ACTIVE, approved, plugin.manifest.version);
        await this.registry.writeLog('WARN', `Auto-approved for "${slug}": [${missing.join(', ')}]`, slug);
        try {
          const notifications = NotificationsContextProxy.createNotificationsProxy(this.manager, 'core');
          await notifications.notifyAdmins({
            subject: `[Atlantis] Auto-approved new capabilities for "${slug}"`,
            text: `"${slug}" now asks for [${missing.join(', ')}] and was auto-approved (AUTO_APPROVE_PLUGIN_CAPABILITIES on, plugin trusted). Review in Admin -> Plugins if unexpected.`,
          });
        } catch { /* best-effort */ }
      } else {
        // It asks for more than was approved. Do NOT silently deactivate (that looked like a deliberate
        // disable and caused a prod outage): hold it, so the admin sees what it waits on and approves it.
        state = PluginState.INACTIVE;
        heldReason = PluginHeldReason.CAPABILITY_DRIFT;
        this.logger.warn(`Plugin "${slug}" HELD: it asks for [${missing.join(', ')}], which nobody approved. Approve it to activate.`);
        await this.registry.markPluginHeld(slug, heldReason);
      }
    } else if (state === PluginState.ACTIVE && approved.some((entry) => !PluginConsentSet.of(plugin.manifest).includes(entry))) {
      // It asks for LESS than was approved. Nothing to hold — but the approval shrinks with it, so a
      // later release that asks for the dropped entry again needs approving again.
      approved = PluginConsentSet.of(plugin.manifest);
      await this.registry.savePluginState(slug, PluginState.ACTIVE, approved, plugin.manifest.version);
    }
    return { state, heldReason, saved, approved };
  }
}
