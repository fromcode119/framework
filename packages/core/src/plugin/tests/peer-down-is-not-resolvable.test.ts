import { describe, expect, it } from 'vitest';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * A peer whose PROCESS is down is absent, not present-and-broken.
 *
 * Nothing in the loaded record can see that on its own. An isolated plugin is registered as a SPREAD
 * COPY of its host's stubs, so `state` stays ACTIVE and `publicAPI` stays a truthy lazy proxy for the
 * whole of a restart — while that proxy answers `undefined` for every method, because the guest has
 * not described itself yet. The caller therefore walked a present target to a missing method and was
 * told `"<method>" is not callable`.
 *
 * That reads as a broken peer rather than an absent one, and the difference is not cosmetic: a
 * request-time caller degrades either way, but a BOOT REGISTRATION treats it as a permanent failure
 * and never retries, so the registration is silently lost until something else restarts the plugin.
 * Reported to the operator as a failure of code that was working exactly as designed.
 *
 * `isResolvable` is asked by the host walk AND by the guest's own peer snapshot, so answering it here
 * is what stops the two disagreeing.
 */
describe('PluginsManagerResolver.isResolvable — a peer whose process is down', () => {
  const loaded = (over: Partial<ILoadedPlugin> = {}): ILoadedPlugin => ({
    state: PluginState.ACTIVE,
    publicAPI: { doThing: () => 'ok' },
    manifest: { slug: 'sample-widget' },
    ...over,
  } as unknown as ILoadedPlugin);

  it('is NOT resolvable while its guest process is down, though state and publicAPI both still look fine', () => {
    const plugin = loaded({ isRunning: () => false });

    expect(PluginState.resolve(plugin.state)).toBe(PluginState.ACTIVE);
    expect(plugin.publicAPI).toBeTruthy();
    expect(PluginsManagerResolver.isResolvable(plugin, null)).toBe(false);
  });

  it('is resolvable once its guest is up again', () => {
    expect(PluginsManagerResolver.isResolvable(loaded({ isRunning: () => true }), null)).toBe(true);
  });

  it('is resolvable when it reports no running state at all — an in-process plugin has no process to lose', () => {
    expect(PluginsManagerResolver.isResolvable(loaded(), null)).toBe(true);
  });

  /**
   * The reason `isRunning` is a function rather than a getter: the registry builds the loaded record
   * with `{ ...host.stubs() }`, and a spread reads a getter ONCE. This proves the live value is what
   * is asked, not a value frozen at registration.
   */
  it('is asked each time, so a plugin that goes down after being registered stops resolving', () => {
    let up = true;
    const plugin = { ...loaded(), isRunning: () => up } as ILoadedPlugin;

    expect(PluginsManagerResolver.isResolvable(plugin, null)).toBe(true);
    up = false;
    expect(PluginsManagerResolver.isResolvable(plugin, null)).toBe(false);
  });
});
