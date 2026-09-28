import type { ReactNode } from 'react';
import { ClientType } from '@fromcode119/core/client';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import * as ReactorRuntime from '@fromcode119/react-class-components';
import { PluginsProvider } from '@fromcode119/react';
import { AdminLocaleSync } from '@/app/components/view/admin-locale-sync.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { ThemeProvider } from '@/components/view/theme-context.client';
import { AdminRuntimeProvider } from '@/components/view/admin-runtime-provider.client';
import * as SharedComponents from '@/components';
import { AdminServices } from '@/lib/admin-services';
import { ThemeStyleVariantSelect } from '@fromcode119/sdk/admin/theme-style-variant-select';
import { AdminConstants } from '@/lib/constants/admin.constants';

import { AdminPluginRuntimeProvider } from '@/app/components/view/admin-plugin-runtime-provider.client';
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

  /**
   * The console's language. The tree below is keyed by it, so a change re-renders every screen in the
   * new language. The first render matches the server's (English); the remembered language is applied
   * right after mount, and `AdminLocaleSync` then confirms it against the setting.
   */
  @state private locale = AdminI18n.locale;
  private unsubscribeLocale: (() => void) | null = null;

  componentDidMount(): void {
    this.unsubscribeLocale = AdminI18n.subscribe((locale) => { this.locale = locale; });
    const remembered = AdminI18n.remembered();
    if (remembered) AdminI18n.setLocale(remembered);
  }

  componentWillUnmount(): void {
    this.unsubscribeLocale?.();
  }

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
   *
   * `ThemeStyleVariantSelect` is the one component `@fromcode119/sdk/admin` adds of its OWN. A theme
   * bundle reads that path from this registry, so without it the component was `undefined` there.
   */
  private static buildRuntimeModules(): Record<string, Record<string, unknown>> {
    const source = { ...(SharedComponents as Record<string, unknown>), AdminServices, ThemeStyleVariantSelect };
    const modules = ClientLayoutRuntimeService.buildRuntimeModules(source, ReactorRuntime as Record<string, unknown>);
    ClientLayoutRuntimeService.seedWindowRuntimeModules(modules['@fromcode119/admin'], modules['@fromcode119/react-class-components']);
    return modules;
  }

  render(): ReactNode {
    return (
      <PluginsProvider
        apiUrl={AdminConstants.API_BASE_URL}
        clientType={ClientType.ADMIN_UI}
        runtimeModules={this.runtimeModules}
      >
        <AdminLocaleSync />
        <AppearanceRuntimeLoader>
          <ThemeProvider>
            <AdminRuntimeProvider>
              <AdminPluginRuntimeProvider>
                <AppearanceShellHostShim key={this.locale}>{this.children}</AppearanceShellHostShim>
              </AdminPluginRuntimeProvider>
            </AdminRuntimeProvider>
          </ThemeProvider>
        </AppearanceRuntimeLoader>
      </PluginsProvider>
    );
  }
}
