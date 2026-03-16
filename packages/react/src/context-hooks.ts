import { useCallback, useContext, useMemo } from 'react';
import { SystemConstants } from '@fromcode119/core/client';
import { PluginContextRegistry } from './plugin-context';

export class ContextHooks {
  static usePlugins() {
    const context = useContext(PluginContextRegistry.Context);
    if (!context) {
      throw new Error('usePlugins must be used within a PluginsProvider');
    }

    return context;
  }

  static useTranslation() {
    const { t, locale, setLocale } = ContextHooks.usePlugins();
    return { t, locale, setLocale };
  }

  static usePluginAPI(slug: string) {
    const { api } = ContextHooks.usePlugins();
    const pluginPrefix = `${SystemConstants.API_PATH.PLUGINS.BASE}/${slug}`;

    return useMemo(
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

  static usePluginState(pluginSlug: string, key?: string) {
    const { pluginState, setPluginState } = ContextHooks.usePlugins();
    const state = pluginState[pluginSlug] || {};

    const setter = useCallback(
      (value: any) => {
        if (key) {
          setPluginState(pluginSlug, key, value);
        } else {
          Object.entries(value).forEach(([k, v]) => {
            setPluginState(pluginSlug, k, v);
          });
        }
      },
      [pluginSlug, key, setPluginState],
    );

    if (key) {
      return [state[key], setter] as const;
    }

    return [state, setter] as const;
  }
}