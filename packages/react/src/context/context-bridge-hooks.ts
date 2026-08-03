import React from 'react';
import { PluginStateContext } from '@react/context/plugin-state-context';
import { TranslationContext } from '@react/context/translation-context';
import { PluginContextRegistry } from '@react/plugin-context';
import type { IPluginContextValue } from '@react/interfaces/plugin-context-value.interface';

export class ContextBridgeHooks {
  static usePluginsBridgeHook(): IPluginContextValue {
    const context = React.useContext(PluginContextRegistry.Context);
    if (!context) {
      throw new Error('usePlugins must be used within a PluginsProvider');
    }

    return context;
  }

  static useTranslationBridgeHook() {
    return React.useContext(TranslationContext.Context);
  }

  static usePluginStateBridgeHook(pluginSlug: string, key?: string) {
    const { pluginState, setPluginState } = React.useContext(PluginStateContext.Context);
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
