import React from 'react';
import { Bridge, prop } from '@fromcode119/react-class-components';
import { ContextHooks } from '@react/context-hooks/context-hooks';
import { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
import type { PluginRuntimeValue } from '@react/plugin-runtime-value';
import { PluginNavigation } from '@react/plugin-navigation';

/**
 * The single plugin hook boundary — reads the context-backed hooks ONCE and republishes them
 * via {@link PluginRuntimeContext} so plugin UI components can be hook-free classes. Mount it in
 * the plugin-render host (admin/theme) inside PluginsProvider. The hook reads live in `read()`,
 * the one hook-bearing method a {@link Bridge} allows.
 */
export class PluginRuntimeProvider extends Bridge<PluginRuntimeValue> {
  @prop declare children: React.ReactNode;

  /**
   * The host's navigator. Optional so an un-updated host still mounts, but a host that HAS a router
   * should pass it — without one every plugin navigation is a full page reload of the whole console.
   */
  @prop declare navigate?: (path: string, options?: { replace?: boolean }) => void;

  protected read(): PluginRuntimeValue {
    const translation = ContextHooks.useTranslation();
    return {
      plugins: ContextHooks.usePlugins(),
      translation,
      globalSettings: ContextHooks.useGlobalSettings() as Record<string, any>,
      collections: ContextHooks.useCollections() as any[],
      // No standalone locale hook exists; the canonical active locale lives on the translation context.
      locale: translation?.locale ?? 'en',
      api: ContextHooks.useAPI?.() ?? null,
      navigation: new PluginNavigation(this.navigate),
    };
  }

  protected present(value: PluginRuntimeValue): React.ReactElement {
    return <PluginRuntimeContext.context.Provider value={value}>{this.children}</PluginRuntimeContext.context.Provider>;
  }
}
