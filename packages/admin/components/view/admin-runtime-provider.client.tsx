import type { ReactElement, ReactNode } from 'react';
import { Bridge, prop } from '@fromcode119/reactor';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { ContextHooks } from '@fromcode119/react';
import { ThemeHooks } from '@/components/view/use-theme.client';
import { NotificationHooks } from '@/components/view/use-notification.client';
import { AuthHooks } from '@/components/view/use-auth.client';
import { AdminRuntimeProviderView } from '@/components/view/admin-runtime-provider-view.client';
import type { IAdminRuntimeProviderProps } from '@/components/interfaces/admin-runtime-provider-props.interface';
import type { IAdminRuntimeValues } from '@/components/interfaces/admin-runtime-values.interface';
import { AdminAppearanceRegistry } from '@/lib/appearance/admin-appearance-registry';
import { DefaultAdminAppearanceBootstrap } from '@/lib/appearance/default-admin-appearance-bootstrap';
import { ActiveAdminAppearanceService } from '@/lib/appearance/active-admin-appearance-service';
import { AdminComponentRegistry } from '@/lib/appearance/admin-component-registry';
import { DefaultAdminComponentsBootstrap } from '@/lib/appearance/default-admin-components-bootstrap';

/**
 * The single admin hook boundary — reads every context-backed hook ONCE and republishes the
 * values (via {@link AdminRuntimeProviderView}) through the admin runtime context so all other
 * admin components can be hook-free classes. Must render inside ThemeProvider + PluginsProvider
 * + NotificationProvider.
 *
 * The hook reads live in `read()` — the one hook-bearing method a {@link Bridge} allows — so this is
 * a class like everything else (mirrors the theme's ThemeProvider).
 */
export class AdminRuntimeProvider extends Bridge<IAdminRuntimeValues, IAdminRuntimeProviderProps> {
  /**
   * Registers the framework's built-in defaults exactly once. A static field initialiser runs when the
   * CLASS is evaluated, which is when this module is evaluated — the same timing the two module-level
   * `register()` calls had, without the module-level statements. Both registrars are idempotent.
   *
   * External appearances are loaded at runtime from `appearance/<slug>/dist/bundle.js` by the
   * AppearanceRuntimeLoader (mounted + served by the admin) — importing a bundle self-registers it.
   */
  private static readonly bootstrapped = AdminRuntimeProvider.bootstrap();

  @prop declare children: ReactNode;

  private static bootstrap(): boolean {
    DefaultAdminAppearanceBootstrap.register(AdminAppearanceRegistry.shared);
    DefaultAdminComponentsBootstrap.register(AdminComponentRegistry.shared);
    return true;
  }

  protected read(): IAdminRuntimeValues {
    const { theme, toggleTheme } = ThemeHooks.useTheme();
    const globalSettings = ContextHooks.useGlobalSettings() as Record<string, any>;
    return {
      theme,
      toggleTheme,
      notify: NotificationHooks.useNotify(),
      globalSettings,
      plugins: ContextHooks.usePlugins(),
      collections: ContextHooks.useCollections() as any[],
      router: useRouter(),
      pathname: usePathname() ?? '',
      params: useParams() as Record<string, string | string[]>,
      auth: AuthHooks.useAuth(),
    };
  }

  protected present(values: IAdminRuntimeValues): ReactElement {
    const { theme, toggleTheme, notify, globalSettings, plugins, collections, router, pathname, params, auth } = values;
    const activeAppearanceId = ActiveAdminAppearanceService.select(globalSettings as Record<string, unknown>);
    return (
      <AdminRuntimeProviderView
        theme={theme}
        toggleTheme={toggleTheme}
        notify={notify}
        globalSettings={globalSettings}
        plugins={plugins}
        collections={collections}
        router={router}
        pathname={pathname}
        params={params}
        auth={auth}
        activeAppearanceId={activeAppearanceId}
      >
        {this.children}
      </AdminRuntimeProviderView>
    );
  }
}
