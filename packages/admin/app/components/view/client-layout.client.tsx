import type { ReactNode } from 'react';
import { ClientType } from '@fromcode119/core/client';
import { Reactor, prop } from '@fromcode119/reactor';
import * as ReactorRuntime from '@fromcode119/reactor';
import { PluginsProvider, PluginRuntimeProvider } from '@fromcode119/react';
import { ThemeProvider } from '@/components/view/theme-context.client';
import { AdminRuntimeProvider } from '@/components/view/admin-runtime-provider.client';
import * as SharedComponents from '@/components';
import { AdminServices } from '@/lib/admin-services';
import { AdminConstants } from '@/lib/constants/admin.constants';

import { AppearanceShellHostShim } from '@/app/components/view/appearance-shell-host-shim.client';
import { AppearanceRuntimeLoader } from '@/app/components/view/appearance-runtime-loader.client';
import { AdminIconRegistryBootstrapService } from '@/app/services/admin-icon-registry-bootstrap-service';
import { AdminThemeEntryScriptGuardService } from '@/app/services/admin-theme-entry-script-guard-service';
import { ClientLayoutRuntimeService } from '@/app/services/client-layout-runtime-service';

/**
 * Admin client layout. Builds the runtime-module bridge ONCE (the `useMemo([])` this replaces) and
 * mounts the provider stack.
 */
export class ClientLayout extends Reactor {
  /**
   * Installs the admin's icon registry and theme-entry guard exactly once. A static field initialiser
   * runs on CLASS evaluation, i.e. module evaluation — the same timing the two module-level `install()`
   * calls had, without the module-level statements.
   */
  private static readonly installed = ClientLayout.install();

  @prop declare children: ReactNode;

  private static install(): boolean {
    AdminIconRegistryBootstrapService.install();
    AdminThemeEntryScriptGuardService.install();
    return true;
  }

  /** Built once per instance — the class field replaces `useMemo(fn, [])`. */
  private readonly runtimeModules = ClientLayout.buildRuntimeModules();

  /**
   * AdminServices lives in @/lib (not the @/components barrel), but plugins import it from
   * `@fromcode119/sdk/admin` (which re-exports it from `@fromcode119/admin/services`). Merge it
   * into the runtime source so the bridge exposes it on the admin runtime modules.
   */
  private static buildRuntimeModules(): Record<string, Record<string, unknown>> {
    const source = { ...(SharedComponents as Record<string, unknown>), AdminServices };
    const modules = ClientLayoutRuntimeService.buildRuntimeModules(source, ReactorRuntime as Record<string, unknown>);
    ClientLayoutRuntimeService.seedWindowRuntimeModules(modules['@fromcode119/admin'], modules['@fromcode119/reactor']);
    return modules;
  }

  render(): ReactNode {
    return (
      <PluginsProvider
        apiUrl={AdminConstants.API_BASE_URL}
        clientType={ClientType.ADMIN_UI}
        runtimeModules={this.runtimeModules}
      >
        <AppearanceRuntimeLoader>
          <ThemeProvider>
            <AdminRuntimeProvider>
              <PluginRuntimeProvider>
                <AppearanceShellHostShim>{this.children}</AppearanceShellHostShim>
              </PluginRuntimeProvider>
            </AdminRuntimeProvider>
          </ThemeProvider>
        </AppearanceRuntimeLoader>
      </PluginsProvider>
    );
  }
}
