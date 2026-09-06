import type { ReactNode } from 'react';
import { ContextRuntimeBridge } from '@fromcode119/react/context-runtime-bridge';
import { PluginApiRegistryStore } from '@fromcode119/react/context/plugin-api-registry-store';
import { PluginsProviderSeed } from '@fromcode119/react/context/plugins-provider-seed';
import { PreBootRegistrationSeed } from '@fromcode119/react/context/pre-boot-registration-seed';
import { PluginsProvider } from '@fromcode119/react/context/view/plugins-provider.client';
import { PreBootBridgeArgs } from '@fromcode119/react/helpers/pre-boot-bridge-args';
import { FrontendRuntimeScheduler } from '@/app/frontend-runtime-scheduler';
import { PluginLoaderMountService } from '@/app/plugin-loader-mount-service';
import { FrontendApiBaseUrl } from '@/lib/api-base-url';
import { FrontendRuntimeConfig } from '@/runtime/frontend-runtime-config';
import { StorefrontBundleLoader } from '@/runtime/storefront-bundle-loader';
import { OverrideLoaderWarmup } from '@/runtime/override-loader-warmup';
import { StorefrontHydrator } from '@/runtime/storefront-hydrator';
import { StorefrontRuntimeGlobals } from '@/runtime/storefront-runtime-globals';
import { StorefrontFallbackPage } from '@/runtime/view/storefront-fallback-page.client';
import { StorefrontPageView } from '@/runtime/view/storefront-page-view.client';
import { StorefrontRuntimeRoot } from '@/runtime/view/storefront-runtime-root.client';

/**
 * Entry of the standalone storefront runtime bundle (`/fc-runtime/runtime-<hash>.js`).
 *
 * Boot order, after `load` (the same deferral as today's `StorefrontRuntimeGate`):
 *   1. globals — the `process` shim and the icon provider (`StorefrontRuntimeGlobals`);
 *   2. the PRE-BOOT bridge — the full bridge object, the runtime registry's React/ReactDOM/JSX/lucide
 *      entries and the import map, with registrations routed to the pre-boot queue; plus the theme's
 *      CSS, variables and plugin head/CSS injections from the document's config;
 *   3. the theme bundle, then every eager plugin bundle, evaluated against that bridge;
 *   4. the seed — the queued registrations folded into the provider's initial state together with the
 *      inlined `/system/frontend` payload — then every code-split override's module resolved (warm-up), and
 *      inlined `/system/frontend` payload and the locale's translations — adopted by the pre-boot
 *      bridge too, so `ContextBridge.t()`/`getState()` answer from it during the hydrating render;
 *   5. `hydrateRoot(#fc-root, <StorefrontRuntimeRoot seed><StorefrontPageView/></>)`, or the
 *      `createRoot` + `ServerMarkupHandoff` fallback when parity cannot be guaranteed (`StorefrontHydrator`).
 * Idle-strategy plugins load later through the live bridge (`PluginLoader`), as before.
 *
 * Runs on CLASS evaluation, which for an entry module is module evaluation — a static field initialiser
 * rather than a top-level statement, the same shape as `PluginUiStorefrontEntry`. A document without a
 * `#fc-runtime-config` (nothing served the islands document yet) gets steps 1–2 and stops: the registry
 * is populated, nothing is mounted, and the console says so.
 */
export class FrontendRuntimeEntry {
  private static readonly booted = FrontendRuntimeEntry.boot();

  private static boot(): boolean {
    FrontendRuntimeScheduler.run(FrontendRuntimeEntry.start);
    return true;
  }

  private static start(): void {
    FrontendRuntimeEntry.mount().catch((error) => console.error('[frontend] runtime boot failed:', error));
  }

  private static async mount(): Promise<void> {
    StorefrontRuntimeGlobals.install();
    const config = FrontendRuntimeConfig.fromDocument();
    const apiUrl = FrontendApiBaseUrl.resolveFrontendApiBaseUrl(config?.apiUrl);
    const pluginApiStore = new PluginApiRegistryStore();
    const events = new Map<string, Set<(data: any) => void>>();

    const preBootArgs = PreBootBridgeArgs.build({
      apiUrl,
      frontendConfig: config?.frontend ?? {},
      locale: config?.locale ?? '',
      translations: config?.translations ?? {},
      pluginApiStore,
      events,
      PluginsProvider,
    });
    ContextRuntimeBridge.installPreBootBridge(preBootArgs);
    if (!config) {
      console.warn(`[frontend] runtime: no #${FrontendRuntimeConfig.ELEMENT_ID} in the document — nothing to hydrate`);
      return;
    }

    FrontendRuntimeEntry.mountAssets(config, apiUrl);
    const preloaded = await StorefrontBundleLoader.loadEager(config.activeTheme, config.plugins, apiUrl);
    const registrations = PreBootRegistrationSeed.consume(window as unknown as Record<string, any>);
    // Every code-split renderer resolved before hydration — see OverrideLoaderWarmup.
    await OverrideLoaderWarmup.warm(registrations.overrides);
    const seed = PluginsProviderSeed.fromFrontendConfig({
      config: config.frontend,
      registrations,
      translations: config.translations,
      locale: config.locale,
      pluginApiStore,
      events,
    });
    // From here until the live install, every bridge-level read answers from the seed the provider
    // mounts with — the hydrating render sees the seeded state, not the pre-config stand-in.
    PreBootBridgeArgs.adopt(preBootArgs, seed);

    const root = (children: ReactNode) => (
      <StorefrontRuntimeRoot apiUrl={apiUrl} seed={seed} preloadedModules={preloaded} skipPlugins={config.skipPlugins}>{children}</StorefrontRuntimeRoot>
    );
    new StorefrontHydrator({
      host: document.getElementById(StorefrontHydrator.ROOT_ID),
      config,
      registrations,
      hydrateTree: root(<StorefrontPageView config={config} />),
      fallbackTree: (serverHtml) => root(<StorefrontFallbackPage config={config} serverHtml={serverHtml} />),
    }).mount();
  }

  /**
   * What `loadConfig` and `PluginLoader.runMount` mount from the config, done BEFORE the bundles
   * evaluate so the first hydrated paint already has every stylesheet. All idempotent — `PluginLoader`
   * repeats them at mount and finds them present.
   */
  private static mountAssets(config: FrontendRuntimeConfig, apiUrl: string): void {
    if (config.cssVariables && !document.getElementById('fc-theme-variables')) {
      const style = document.createElement('style');
      style.id = 'fc-theme-variables';
      style.textContent = config.cssVariables;
      document.head.appendChild(style);
    }
    PluginLoaderMountService.mountThemeCss(config.activeTheme, apiUrl);
    PluginLoaderMountService.mountHeadInjections(config.plugins, apiUrl);
    PluginLoaderMountService.mountPluginCss(config.plugins, apiUrl);
  }
}
