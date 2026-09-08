// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientType } from '@fromcode119/core/client';
import { ContextBridge } from '@fromcode119/react/context-bridge';
import { ContextRuntimeBridge } from '@fromcode119/react/context-runtime-bridge';
import { PluginApiRegistryStore } from '@fromcode119/react/context/plugin-api-registry-store';
import { PluginsProviderSeed } from '@fromcode119/react/context/plugins-provider-seed';
import { PreBootRegistrationSeed } from '@fromcode119/react/context/pre-boot-registration-seed';
import { PluginsProvider } from '@fromcode119/react/context/view/plugins-provider.client';
import { PreBootBridgeArgs } from '@fromcode119/react/helpers/pre-boot-bridge-args';
import type { IPreBootBridgeInputs } from '@fromcode119/react/interfaces/pre-boot-bridge-inputs.interface';

/**
 * The pre-boot bridge must never answer a lie. During the FIRST (hydrating) render the live provider has
 * not yet installed its bridge (that happens in its effect), so `ContextBridge.t()` / `getState()` /
 * `getFrontendMetadata()` answer from the pre-boot args. Those answers come from the document's inlined
 * data — the translations and the config at install, the folded seed once the bundles have evaluated —
 * and this suite pins them to what the SAME seed makes the live provider answer.
 */
class BridgeFixture {
  static readonly Layout = function DefaultLayout(): null { return null; };

  static readonly serverTranslations = { greeting: 'Hello {{name}}', nav: { home: 'Home', shop: 'Shop' } };

  static readonly frontendConfig = {
    activeTheme: { slug: 'demo', defaultLayout: 'DefaultLayout', variables: { accent: '#123456' } },
    plugins: [{ slug: 'zeta', namespace: 'org.fromcode', admin: { collections: [{ slug: 'pages' }] } }],
    settings: { siteName: 'Demo' },
    menu: [{ id: 1, label: 'Home', path: '/' }],
    runtimeModules: { 'lucide-react': 'icon' },
  };

  /** What the theme and a plugin bundle queue at evaluation: a layout, theme copy, plugin copy. */
  static queue(): Array<{ type: string; args: any[] }> {
    return [
      { type: 'theme', args: ['demo', { layouts: { DefaultLayout: BridgeFixture.Layout }, variables: { accent: '#abcdef' } }] },
      { type: 'translations', args: [{ en: { nav: { home: 'Start' } } }, 'theme'] },
      { type: 'translations', args: [{ en: { zeta: { read: 'Read more' } } }] },
    ];
  }

  static inputs(): IPreBootBridgeInputs {
    return {
      apiUrl: 'http://api.test',
      frontendConfig: BridgeFixture.frontendConfig,
      locale: 'en',
      translations: BridgeFixture.serverTranslations,
      pluginApiStore: new PluginApiRegistryStore(),
      events: new Map(),
      PluginsProvider,
    };
  }

  static seed(inputs: IPreBootBridgeInputs): PluginsProviderSeed {
    return PluginsProviderSeed.fromFrontendConfig({
      config: BridgeFixture.frontendConfig,
      registrations: PreBootRegistrationSeed.fold(BridgeFixture.queue()).seed,
      translations: BridgeFixture.serverTranslations,
      locale: 'en',
      pluginApiStore: inputs.pluginApiStore,
      events: inputs.events,
    });
  }

  /** Every bridge-level read a bundle can make, taken through `ContextBridge` (what the import map binds). */
  static answers(): Record<string, unknown> {
    const state = ContextBridge.getState();
    return {
      greeting: ContextBridge.t('greeting', { name: 'Ann' }),
      themeOverServer: ContextBridge.t('nav.home'),
      serverOnly: ContextBridge.t('nav.shop'),
      pluginLayer: ContextBridge.t('zeta.read'),
      missing: ContextBridge.t('missing.key', {}, 'fallback copy'),
      locale: ContextBridge.locale(),
      layouts: Object.keys(state.themeLayouts),
      themeVariables: state.themeVariables,
      settings: state.settings,
      collections: state.collections,
      menuItems: state.menuItems,
      activeThemeSlug: state.activeTheme?.slug,
      isReady: state.isReady,
    };
  }

  static async mountLive(seed: PluginsProviderSeed): Promise<() => void> {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(PluginsProvider, { apiUrl: 'http://api.test', clientType: ClientType.FRONTEND_UI, seed } as never));
    });
    return () => { act(() => root.unmount()); };
  }
}

// React's `act()` warns unless the environment declares itself a test environment.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any)._fromcodeQueue;
});

describe('PreBootBridgeArgs — the pre-boot bridge answers from the inlined data', () => {
  it('stage one (before any bundle evaluated): the server translations and the config, never the key', async () => {
    const args = PreBootBridgeArgs.build(BridgeFixture.inputs());

    expect(args.stableT('greeting', { name: 'Ann' })).toBe('Hello Ann');
    expect(args.stableT('nav.home')).toBe('Home');
    expect(args.stableT('missing.key', {}, 'fallback copy')).toBe('fallback copy');
    expect(args.stableT('missing.key')).toBe('missing.key');

    const state = args.stabilityRef.current;
    expect(state.settings).toEqual({ siteName: 'Demo' });
    expect(state.menuItems).toEqual(BridgeFixture.frontendConfig.menu);
    expect(state.activeTheme.slug).toBe('demo');
    expect(state.themeVariables).toEqual({ accent: '#123456' });
    expect(state.serverRuntimeModules).toEqual({ 'lucide-react': 'icon' });
    expect(state.locale).toBe('en');
    expect(state.isReady).toBe(true);
    // Nothing has registered yet — and the state says so rather than inventing a layout.
    expect(state.themeLayouts).toEqual({});

    const metadata = await args.stableGetFrontendMetadata();
    expect(metadata.activeTheme.slug).toBe('demo');
    expect(metadata.settings).toEqual({ siteName: 'Demo' });
    expect(metadata.themeLayouts).toEqual({});
  });

  it('stage two (the seed adopted): every bridge-level read equals what the SAME seed makes the live provider answer', async () => {
    const inputs = BridgeFixture.inputs();
    const args = PreBootBridgeArgs.build(inputs);
    ContextRuntimeBridge.installPreBootBridge(args);
    const seed = BridgeFixture.seed(inputs);
    PreBootBridgeArgs.adopt(args, seed);

    // The pre-boot answers, as a theme's render would get them during hydration.
    const preBoot = BridgeFixture.answers();
    expect(preBoot.themeOverServer).toBe('Start'); // theme layer over the server copy
    expect(preBoot.pluginLayer).toBe('Read more'); // plugin layer present
    expect(preBoot.greeting).toBe('Hello Ann');
    expect(preBoot.layouts).toEqual(['DefaultLayout']);
    expect(preBoot.themeVariables).toEqual({ accent: '#abcdef' }); // registered over the theme's own
    expect(preBoot.collections).toEqual([{ slug: 'pages', pluginSlug: 'zeta' }]);

    // Now the live provider mounts with that seed and installs the real bridge from its effect.
    const installed = vi.spyOn(ContextRuntimeBridge, 'installRuntimeBridge');
    const unmount = await BridgeFixture.mountLive(seed);
    expect(installed).toHaveBeenCalled();
    const live = BridgeFixture.answers();
    unmount();

    expect(live).toEqual(preBoot);
  });
});
