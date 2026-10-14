import { PluginState } from '@fromcode119/core/client';
import type { IPluginSwitchInput } from '@/app/plugins/installed/interfaces/plugin-switch-input.interface';

/**
 * What an installed plugin's switch and badge show.
 *
 * TWO AXES on a deployment that can host sites. `state` is the PLATFORM axis (installed, loadable,
 * healthy). `enabledForTenant` is the SITE axis, and the api answers it only when a site is bound to
 * the request — otherwise it is `null`, meaning "no site here", not "off".
 *
 * The switch is rendered only at platform scope (a site admin gets the site's own plugin screens), and
 * at platform scope no site is bound. Reading `null` as "off for this site" made every switch show off
 * and every badge say "Off here" on any deployment able to host sites — whatever the platform's state —
 * and disabled the switch of a plugin that was inactive, so it could not be turned on from here.
 */
export class PluginSwitchState {
  /** True only when a site is bound, so the per-site answer exists. */
  readonly perSite: boolean;
  /** Installed, healthy and running on the platform. */
  readonly availableOnPlatform: boolean;
  /** What the switch shows: the site's answer when there is one, the platform's otherwise. */
  readonly switchedOn: boolean;
  /** Healthy on the platform but not run by the site being looked at. */
  readonly notOnThisSite: boolean;
  /** The platform axis blocks a per-site switch; at platform scope the switch IS the platform axis, so never. */
  readonly locked: boolean;

  constructor(plugin: IPluginSwitchInput) {
    const multiTenant = plugin.multiTenant === true;
    this.perSite = multiTenant && (plugin.enabledForTenant === true || plugin.enabledForTenant === false);
    this.availableOnPlatform = plugin.state === PluginState.ACTIVE;
    this.switchedOn = this.perSite ? plugin.enabledForTenant === true : this.availableOnPlatform;
    this.notOnThisSite = this.perSite && this.availableOnPlatform && !this.switchedOn;
    this.locked = this.perSite && !this.availableOnPlatform;
  }
}
