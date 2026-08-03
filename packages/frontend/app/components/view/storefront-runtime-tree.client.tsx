import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { GlobalInitializer } from '@/app/components/view/global-initializer.client';
import { RootProvider } from '@/app/components/view/root-provider.client';
import { PluginLoader } from '@/app/components/view/plugin-loader.client';

/**
 * The plugin runtime, as ONE module so it can be code-split away from the route.
 *
 * `PluginsProvider` anchors essentially the whole client graph — every context, hook aggregator, the
 * runtime bridge, the icon registry — and while it sat directly in `layout.tsx` that graph was part of
 * every storefront route. Isolating it here is what lets `StorefrontRuntimeGate` pull it in on its own
 * schedule instead of at route load.
 *
 * The page is fully painted before any of this exists: the server renders the layout and the block flow,
 * and the content components fall back to the server markup while the plugin context is absent.
 */
export class StorefrontRuntimeTree extends Reactor {
  @prop declare children: ReactNode;

  render(): ReactNode {
    return (
      <>
        <GlobalInitializer />
        <RootProvider>
          <PluginLoader />
          {this.children}
        </RootProvider>
      </>
    );
  }
}
