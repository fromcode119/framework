import React from 'react';
import { SystemConstants } from '@fromcode119/core/client';
import { PluginContextRegistry } from '../plugin-context';
import type { PluginContextValue } from '../context.interfaces';

export class ContextBridgeHooks {
  static usePluginsBridgeHook(): PluginContextValue {
    const context = React.useContext(PluginContextRegistry.Context);
    if (!context) {
      throw new Error('usePlugins must be used within a PluginsProvider');
    }

    return context;
  }

  static useTranslationBridgeHook() {
    const { t, locale, setLocale } = ContextBridgeHooks.usePluginsBridgeHook();
    return { t, locale, setLocale };
  }

  static usePluginApiBridgeHook(slug: string) {
    const { api } = ContextBridgeHooks.usePluginsBridgeHook();
    const pluginPrefix = `${SystemConstants.API_PATH.PLUGINS.BASE}/${slug}`;

    return React.useMemo(
      () => ({
        get: (path: string, options?: any) =>
          api.get(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, options),
        post: (path: string, body?: any, options?: any) =>
          api.post(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, body, options),
        put: (path: string, body?: any, options?: any) =>
          api.put(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, body, options),
        delete: (path: string, options?: any) =>
          api.delete(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, options),
        patch: (path: string, body?: any, options?: any) =>
          api.patch(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, body, options),
      }),
      [api, pluginPrefix],
    );
  }

  static usePluginStateBridgeHook(pluginSlug: string, key?: string) {
    const { pluginState, setPluginState } = ContextBridgeHooks.usePluginsBridgeHook();
    const state = pluginState[pluginSlug] || {};

    const setter = React.useCallback(
      (value: any) => {
        if (key) {
          setPluginState(pluginSlug, key, value);
          return;
        }

        Object.entries(value).forEach(([entryKey, entryValue]) => {
          setPluginState(pluginSlug, entryKey, entryValue);
        });
      },
      [pluginSlug, key, setPluginState],
    );

    if (key) {
      return [state[key], setter] as const;
    }

    return [state, setter] as const;
  }
}
