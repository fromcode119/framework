import { ClientType } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/react-class-components';
import { PluginsProvider } from '@fromcode119/react/context/view/plugins-provider.client';
import type { PluginsProviderSeed } from '@fromcode119/react/context/plugins-provider-seed';
import { PluginRuntimeProvider } from '@fromcode119/react/view/plugin-runtime-provider.client';
import { SystemGate } from '@/components/view/system-gate.client';
import { ThemeInitializer } from '@/components/view/theme-initializer.client';
import { PluginLoader } from '@/app/components/view/plugin-loader.client';
import { StorefrontNavigationListener } from '@/runtime/view/storefront-navigation-listener.client';

/**
 * The provider stack of the islands runtime — `RootProvider` + `StorefrontRuntimeTree` with three
 * differences and nothing else:
 *   - `PluginsProvider` is SEEDED: its first render already holds the theme's layouts, the plugins'
 *     slots, the document's config and translations, so the tree it renders is the server tree;
 *   - `StorefrontNavigationListener` replaces `RouterBridge` — there is no App Router in an islands
 *     document, and `useRouter()` outside one throws;
 *   - `PluginLoader` is told which bundles the boot already evaluated, so it loads only the idle ones.
 * Everything a theme sees through the bridge is unchanged.
 */
export class StorefrontRuntimeRoot extends Reactor {
  @prop declare apiUrl: string;

  @prop declare seed: PluginsProviderSeed;

  /** Module keys `StorefrontBundleLoader` already imported. */
  @prop declare preloadedModules: Iterable<string>;

  /** Plugin slugs whose storefront bundle this page skips (`FrontendRuntimeConfig.skipPlugins`). */
  @prop declare skipPlugins?: Iterable<string>;

  @prop declare children: ReactNode;

  render(): ReactNode {
    return (
      <PluginsProvider apiUrl={this.apiUrl} clientType={ClientType.FRONTEND_UI} seed={this.seed}>
        <StorefrontNavigationListener />
        <ThemeInitializer />
        <PluginRuntimeProvider>
          <SystemGate>
            <PluginLoader preloadedModules={this.preloadedModules} skipPlugins={this.skipPlugins} />
            {this.children}
          </SystemGate>
        </PluginRuntimeProvider>
      </PluginsProvider>
    );
  }
}
