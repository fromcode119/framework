"use client";

import React from 'react';
import { ContextHooks } from './context-hooks';
import { PluginRuntimeContext } from './plugin-runtime-context';
import type { PluginRuntimeValue } from './plugin-runtime-context.interfaces';
import type { PluginRuntimeProviderProps } from './plugin-runtime-provider.interfaces';

/**
 * The single plugin hook boundary — reads the context-backed hooks ONCE and republishes them
 * via {@link PluginRuntimeContext} so plugin UI components can be hook-free classes. Mount it in
 * the plugin-render host (admin/theme) inside PluginsProvider. Intentionally a function component:
 * React hooks have no class API, so exactly one functional boundary is unavoidable.
 */
export function PluginRuntimeProvider({ children }: PluginRuntimeProviderProps): React.ReactElement {
  const plugins = ContextHooks.usePlugins();
  const translation = ContextHooks.useTranslation();
  const globalSettings = ContextHooks.useGlobalSettings() as Record<string, any>;
  const collections = ContextHooks.useCollections() as any[];
  // No standalone locale hook exists; the canonical active locale lives on the translation context.
  const locale = translation?.locale ?? 'en';
  const api = ContextHooks.useAPI?.() ?? null;

  const value = React.useMemo<PluginRuntimeValue>(
    () => ({ plugins, translation, globalSettings, collections, locale, api }),
    [plugins, translation, globalSettings, collections, locale, api],
  );

  return <PluginRuntimeContext.context.Provider value={value}>{children}</PluginRuntimeContext.context.Provider>;
}
