"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ContextHooks } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { NotificationHooks } from '@/components/use-notification';
import { AuthHooks } from '@/components/use-auth';
import { AdminRuntimeProviderView } from './admin-runtime-provider-view';
import type { AdminRuntimeProviderProps } from './admin-runtime-provider.interfaces';
import { AdminAppearanceRegistry } from '@/lib/appearance/admin-appearance-registry';
import { DefaultAdminAppearanceBootstrap } from '@/lib/appearance/default-admin-appearance-bootstrap';
import { ActiveAdminAppearanceService } from '@/lib/appearance/active-admin-appearance-service';
import { AdminComponentRegistry } from '@/lib/appearance/admin-component-registry';
import { DefaultAdminComponentsBootstrap } from '@/lib/appearance/default-admin-components-bootstrap';

// Register the framework's built-in default admin appearance once on import (idempotent).
DefaultAdminAppearanceBootstrap.register(AdminAppearanceRegistry.shared);
// Register the framework's default admin UI primitives once on import (idempotent).
DefaultAdminComponentsBootstrap.register(AdminComponentRegistry.shared);
// External appearances are loaded at runtime from repo-root appearance/<slug>/dist/bundle.js by the
// AppearanceRuntimeLoader (mounted + served by the admin) — importing a bundle self-registers it.

/**
 * The single admin hook boundary — reads every context-backed hook ONCE and republishes the
 * values (via {@link AdminRuntimeProviderView}) through the admin runtime context so all other
 * admin components can be hook-free classes. Must render inside ThemeProvider + PluginsProvider
 * + NotificationProvider.
 *
 * This is intentionally a thin function component: React hooks have no class API, so exactly one
 * functional boundary is unavoidable (mirrors the theme's ThemeProvider). It does nothing but
 * call the hooks and hand their values to the class view.
 */
export function AdminRuntimeProvider({ children }: AdminRuntimeProviderProps): React.ReactElement {
  const { theme, toggleTheme } = ThemeHooks.useTheme();
  const notify = NotificationHooks.useNotify();
  const globalSettings = ContextHooks.useGlobalSettings() as Record<string, any>;
  const plugins = ContextHooks.usePlugins();
  const collections = ContextHooks.useCollections() as any[];
  const router = useRouter();
  const pathname = usePathname();
  const auth = AuthHooks.useAuth();
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
      auth={auth}
      activeAppearanceId={activeAppearanceId}
    >
      {children}
    </AdminRuntimeProviderView>
  );
}
