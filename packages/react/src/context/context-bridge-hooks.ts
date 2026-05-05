import React from 'react';
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
