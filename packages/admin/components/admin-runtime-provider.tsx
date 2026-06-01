"use client";

import React from 'react';
import { ContextHooks } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { NotificationHooks } from '@/components/use-notification';
import { AdminRuntimeContext } from './admin-runtime-context';
import type { AdminRuntimeValue } from './admin-runtime-context.interfaces';
import type { AdminRuntimeProviderProps } from './admin-runtime-provider.interfaces';

/**
 * The single admin hook boundary — reads every context-backed hook ONCE and republishes the
 * values through {@link AdminRuntimeContext} so all other admin components can be hook-free
 * classes. Must render inside ThemeProvider + PluginsProvider + NotificationProvider.
 *
 * This is intentionally a function component: React hooks have no class API, so exactly one
 * functional boundary is unavoidable (mirrors the theme's ThemeProvider).
 */
export function AdminRuntimeProvider({ children }: AdminRuntimeProviderProps): React.ReactElement {
  const { theme, toggleTheme } = ThemeHooks.useTheme();
  const notify = NotificationHooks.useNotify();
  const globalSettings = ContextHooks.useGlobalSettings() as Record<string, any>;
  const plugins = ContextHooks.usePlugins();
  const collections = ContextHooks.useCollections() as any[];

  const value = React.useMemo<AdminRuntimeValue>(
    () => ({ theme, toggleTheme, notify, globalSettings, plugins, collections }),
    [theme, toggleTheme, notify, globalSettings, plugins, collections],
  );

  return <AdminRuntimeContext.context.Provider value={value}>{children}</AdminRuntimeContext.context.Provider>;
}
