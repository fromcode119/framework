import { ClientType } from '@fromcode119/core/client';
import React from 'react';
import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { PluginsProvider } from '@fromcode119/react/context/view/plugins-provider.client';
import { PluginRuntimeProvider } from '@fromcode119/react/view/plugin-runtime-provider.client';
import { SystemGate } from '@/components/view/system-gate.client';
import { ThemeInitializer } from '@/components/view/theme-initializer.client';
import { FrontendApiBaseUrl } from '@/lib/api-base-url';
import { RouterBridge } from '@/app/components/view/router-bridge.client';

/** Root client provider stack for the storefront. Hook-free — the router hook lives in RouterBridge. */
export class RootProvider extends Reactor {
  @prop declare children: ReactNode;

  private get apiUrl(): string {
    return FrontendApiBaseUrl.resolveFrontendApiBaseUrl();
  }

  render(): ReactNode {
    return (
      <PluginsProvider apiUrl={this.apiUrl} clientType={ClientType.FRONTEND_UI}>
        <RouterBridge />
        <ThemeInitializer />
        <PluginRuntimeProvider>
          <SystemGate>
            {React.Children.toArray(this.children)}
          </SystemGate>
        </PluginRuntimeProvider>
      </PluginsProvider>
    );
  }
}
