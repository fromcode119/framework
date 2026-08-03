import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminExtensions } from '@/lib/admin-extensions';
import type { IAdminExtensionBridge } from '@/lib/interfaces/admin-extension-bridge.interface';
import type { IAdminExtensionModule } from '@/lib/interfaces/admin-extension-module.interface';
import type { IAdminExtensionDynamicModule } from '@/lib/interfaces/admin-extension-dynamic-module.interface';

export class AdminExtensionLoader extends AdminComponent {
  /**
   * The register hook, wherever the bundle put it.
   *
   * The `typeof` probes stay: this module is loaded at runtime from a PLUGIN bundle, so its shape is
   * untrusted input — not a framework contract that is guaranteed to be there.
   */
  private static resolveRegister(
    module: IAdminExtensionDynamicModule,
  ): IAdminExtensionModule['registerAdminExtension'] {
    if (typeof module?.registerAdminExtension === 'function') return module.registerAdminExtension;
    if (typeof module?.default?.registerAdminExtension === 'function') return module.default.registerAdminExtension;
    return undefined;
  }

  private loadToken = 0;
  private lastRefreshVersion: unknown = undefined;

  private async loadExtensions(): Promise<void> {
    this.lastRefreshVersion = this.runtime?.plugins?.refreshVersion;
    const token = ++this.loadToken;
    const plugins = this.runtime?.plugins ?? {};
    const bridge: IAdminExtensionBridge = {
      registerSlotComponent: plugins.registerSlotComponent,
      registerMenuItem: plugins.registerMenuItem,
    };

    for (const load of AdminExtensions.loaders) {
      try {
        const module = (await load()) as IAdminExtensionDynamicModule;
        if (token !== this.loadToken) return;
        const register = AdminExtensionLoader.resolveRegister(module);
        if (register) register(bridge);
      } catch (error) {
        console.warn('[Admin] Failed to load admin extension module', error);
      }
    }
  }

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

  render(): ReactNode {
    return null;
  }
}
