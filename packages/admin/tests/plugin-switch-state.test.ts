import { describe, expect, it } from 'vitest';
import { PluginState } from '@fromcode119/core/client';
import { PluginSwitchState } from '@/app/plugins/installed/plugin-switch-state';

/**
 * On an install that can host sites, every plugin's switch showed off and every badge said "Off here" at
 * platform scope — the only place the switch is rendered — because the api answers the per-site axis
 * with `null` when no site is bound, and the card read `null` as "off for this site". A user pressed
 * the switch, saw "cms is now active", and the switch stayed off.
 */
describe('PluginSwitchState', () => {
  describe('at platform scope (no site bound: enabledForTenant is null)', () => {
    it('shows an active plugin as on, with no "off here" badge', () => {
      const state = new PluginSwitchState({ state: PluginState.ACTIVE, multiTenant: true, enabledForTenant: null });

      expect(state.switchedOn).toBe(true);
      expect(state.notOnThisSite).toBe(false);
      expect(state.perSite).toBe(false);
    });

    it('shows an inactive plugin as off, and leaves its switch usable so it can be turned on', () => {
      const state = new PluginSwitchState({ state: PluginState.INACTIVE, multiTenant: true, enabledForTenant: null });

      expect(state.switchedOn).toBe(false);
      expect(state.locked).toBe(false);
    });
  });

  describe('with a site bound', () => {
    it('shows the site\'s answer: on when the site runs it', () => {
      const state = new PluginSwitchState({ state: PluginState.ACTIVE, multiTenant: true, enabledForTenant: true });

      expect(state.switchedOn).toBe(true);
      expect(state.notOnThisSite).toBe(false);
    });

    it('says "off here" for a healthy plugin the site does not run', () => {
      const state = new PluginSwitchState({ state: PluginState.ACTIVE, multiTenant: true, enabledForTenant: false });

      expect(state.switchedOn).toBe(false);
      expect(state.notOnThisSite).toBe(true);
    });

    it('locks the switch when the platform itself cannot run the plugin', () => {
      const state = new PluginSwitchState({ state: PluginState.INACTIVE, multiTenant: true, enabledForTenant: false });

      expect(state.locked).toBe(true);
      expect(state.notOnThisSite).toBe(false);
    });
  });

  it('follows the platform state on a deployment with no sites', () => {
    expect(new PluginSwitchState({ state: PluginState.ACTIVE, multiTenant: false, enabledForTenant: null }).switchedOn).toBe(true);
    expect(new PluginSwitchState({ state: PluginState.INACTIVE, multiTenant: false, enabledForTenant: null }).switchedOn).toBe(false);
  });
});
