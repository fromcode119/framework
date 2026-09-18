import { describe, expect, it } from 'vitest';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/**
 * `alpha` / `org.fromcode` are placeholder fixture names — never a real plugin slug.
 *
 * `isRunning` covers a guest process that is dead or mid-relaunch while `state` stays ACTIVE and
 * `publicAPI` stays the stub Proxy created once at registration: both used to read as resolvable,
 * so a caller reached a present-but-broken stub instead of being told the peer was not there.
 */
function loadedPlugin(overrides: Partial<ILoadedPlugin> = {}): ILoadedPlugin {
  return {
    instanceId: 'inst-1',
    state: PluginState.ACTIVE,
    manifest: { slug: 'alpha', namespace: 'org.fromcode' } as ILoadedPlugin['manifest'],
    publicAPI: { registerProvider: () => undefined },
    ...overrides,
  } as ILoadedPlugin;
}

describe('PluginsManagerResolver.isResolvable', () => {
  it('is resolvable when isRunning is absent (in-process plugin, always running)', () => {
    const plugin = loadedPlugin();
    expect(PluginsManagerResolver.isResolvable(plugin, null)).toBe(true);
  });

  it('is resolvable when isRunning() reports true', () => {
    const plugin = loadedPlugin({ isRunning: () => true });
    expect(PluginsManagerResolver.isResolvable(plugin, null)).toBe(true);
  });

  it('is NOT resolvable when isRunning() reports false, even though state is ACTIVE and publicAPI is present', () => {
    const plugin = loadedPlugin({ isRunning: () => false });
    expect(PluginsManagerResolver.isResolvable(plugin, null)).toBe(false);
  });

  it('resolve() returns undefined for a plugin whose guest is down, instead of handing back a broken stub', () => {
    const plugins = new Map<string, ILoadedPlugin>([['alpha', loadedPlugin({ isRunning: () => false })]]);
    const resolver = new PluginsManagerResolver(plugins);
    expect(resolver.resolve('org.fromcode', 'alpha')).toBeUndefined();
    expect(resolver.has('org.fromcode', 'alpha')).toBe(false);
  });

  it('resolve() still hands back the public API once the guest is running again', () => {
    let running = false;
    const plugins = new Map<string, ILoadedPlugin>([['alpha', loadedPlugin({ isRunning: () => running })]]);
    const resolver = new PluginsManagerResolver(plugins);
    expect(resolver.resolve('org.fromcode', 'alpha')).toBeUndefined();
    running = true;
    expect(resolver.resolve('org.fromcode', 'alpha')).toBeDefined();
  });
});
