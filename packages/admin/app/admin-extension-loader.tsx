'use client';

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import { AdminExtensions } from '@/lib/admin-extensions';
import type { AdminExtensionBridge, AdminExtensionModule } from '@/lib/admin-extensions.types';

type AdminExtensionDynamicModule = AdminExtensionModule & {
  default?: AdminExtensionModule;
};

function resolveRegisterAdminExtension(
  module: AdminExtensionDynamicModule,
): AdminExtensionModule['registerAdminExtension'] {
  if (typeof module?.registerAdminExtension === 'function') {
    return module.registerAdminExtension;
  }
  if (typeof module?.default?.registerAdminExtension === 'function') {
    return module.default.registerAdminExtension;
  }
  return undefined;
}

export default class AdminExtensionLoader extends AdminComponent {
  private loadToken = 0;
  private lastRefreshVersion: unknown = undefined;

  private loadExtensions = async (): Promise<void> => {
    this.lastRefreshVersion = this.runtime?.plugins?.refreshVersion;
    const token = ++this.loadToken;
    const plugins = this.runtime?.plugins ?? {};
    const bridge: AdminExtensionBridge = {
      registerSlotComponent: plugins.registerSlotComponent,
      registerMenuItem: plugins.registerMenuItem,
    };

    for (const load of AdminExtensions.loaders) {
      try {
        const module = (await load()) as AdminExtensionDynamicModule;
        if (token !== this.loadToken) return;
        const register = resolveRegisterAdminExtension(module);
        if (register) register(bridge);
      } catch (error) {
        console.warn('[Admin] Failed to load admin extension module', error);
      }
    }
  };

  componentDidMount(): void {
    void this.loadExtensions();
  }

  componentDidUpdate(): void {
    // Re-run only when the plugin registry version changes (slot/menu registrations may differ).
    if (this.runtime?.plugins?.refreshVersion !== this.lastRefreshVersion) {
      void this.loadExtensions();
    }
  }

  componentWillUnmount(): void {
    this.loadToken++;
  }

  render(): React.ReactNode {
    return null;
  }
}
