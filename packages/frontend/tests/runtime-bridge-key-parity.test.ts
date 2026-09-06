// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientType } from '@fromcode119/core/client';
import { ContextRuntimeBridge } from '@fromcode119/react/context-runtime-bridge';
import { PluginApiRegistryStore } from '@fromcode119/react/context/plugin-api-registry-store';
import { PluginsProviderSeed } from '@fromcode119/react/context/plugins-provider-seed';
import { PreBootRegistrationSeed } from '@fromcode119/react/context/pre-boot-registration-seed';
import { PluginsProvider } from '@fromcode119/react/context/view/plugins-provider.client';
import { BridgeObjectBuilder } from '@fromcode119/react/helpers/bridge-object-builder';
import { PreBootBridgeArgs } from '@fromcode119/react/helpers/pre-boot-bridge-args';
import { ReactExportSourceBuilder } from '@fromcode119/react/helpers/react-export-source-builder';
import type { IRuntimeBridgeInstallArgs } from '@fromcode119/react/interfaces/runtime-bridge-install-args.interface';

/**
 * The import map is written ONCE, by the pre-boot install, and the browser ignores later changes to it.
 * Its `@fromcode119/react` module therefore exports exactly the keys the PRE-BOOT bridge object has —
 * and a bundle importing a name the live bridge would have had but the pre-boot one lacks fails at load
 * with "does not provide an export named …". This pins the two installs to one key set: the bridge
 * object built from `PreBootBridgeArgs` and the one built from the args the live provider installs.
 */
class KeyParityFixture {
  static liveArgs: IRuntimeBridgeInstallArgs | null = null;

  static preBootArgs(): IRuntimeBridgeInstallArgs {
    return PreBootBridgeArgs.build({
      apiUrl: 'http://api.test',
      frontendConfig: { activeTheme: { slug: 'demo' }, plugins: [] },
      locale: 'en',
      translations: {},
      pluginApiStore: new PluginApiRegistryStore(),
      events: new Map(),
      PluginsProvider,
    });
  }

  /** Mount the real provider and capture the args its effect installs. */
  static async captureLiveArgs(): Promise<IRuntimeBridgeInstallArgs> {
    vi.spyOn(ContextRuntimeBridge, 'installRuntimeBridge').mockImplementation((args) => { KeyParityFixture.liveArgs = args; });
    const seed = PluginsProviderSeed.fromFrontendConfig({
      config: { activeTheme: { slug: 'demo' }, plugins: [] },
      registrations: PreBootRegistrationSeed.empty(),
      translations: {},
      locale: 'en',
      pluginApiStore: new PluginApiRegistryStore(),
      events: new Map(),
    });
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(PluginsProvider, { apiUrl: 'http://api.test', clientType: ClientType.FRONTEND_UI, seed } as never));
    });
    act(() => root.unmount());
    if (!KeyParityFixture.liveArgs) throw new Error('the provider never installed its bridge');
    return KeyParityFixture.liveArgs;
  }

  static sortedKeys(record: Record<string, unknown>): string[] {
    return Object.keys(record).sort();
  }

  /** The names the import-map module would export for a bridge object. */
  static exportedNames(bridge: Record<string, unknown>): string[] {
    const source = ReactExportSourceBuilder.buildReactExportSource(bridge, 'window.x');
    return [...source.matchAll(/export const (\w+) =/g)].map((match) => match[1]).sort();
  }
}

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
  KeyParityFixture.liveArgs = null;
  delete (window as any)._fromcodeQueue;
});

describe('pre-boot and live bridge installs produce the same import-map key set', () => {
  it('the install args carry the same keys', async () => {
    const preBoot = KeyParityFixture.preBootArgs();
    const live = await KeyParityFixture.captureLiveArgs();
    expect(KeyParityFixture.sortedKeys(preBoot as never)).toEqual(KeyParityFixture.sortedKeys(live as never));
  });

  it('the bridge objects, and therefore the module exports, carry the same keys with no undefined on the pre-boot side', async () => {
    const preBoot = BridgeObjectBuilder.build(KeyParityFixture.preBootArgs());
    const live = BridgeObjectBuilder.build(await KeyParityFixture.captureLiveArgs());

    expect(KeyParityFixture.sortedKeys(preBoot)).toEqual(KeyParityFixture.sortedKeys(live));
    expect(KeyParityFixture.exportedNames(preBoot)).toEqual(KeyParityFixture.exportedNames(live));
    // A key present but `undefined` is dropped from the module source — so it must not happen on either side.
    const undefinedPreBoot = Object.keys(preBoot).filter((key) => preBoot[key] === undefined);
    const undefinedLive = Object.keys(live).filter((key) => live[key] === undefined);
    expect(undefinedPreBoot).toEqual(undefinedLive);
    expect(undefinedPreBoot).toEqual([]);
  });
});
