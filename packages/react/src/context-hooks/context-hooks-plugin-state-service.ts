import { useCallback } from 'react';

export class ContextHooksPluginStateService {
  static usePluginState(
    pluginState: Record<string, Record<string, unknown>>,
    setPluginState: (pluginSlug: string, key: string, value: unknown) => void,
    pluginSlug: string,
    key?: string,
  ) {
    const state = pluginState[pluginSlug] || {};
    const setter = useCallback(
      (value: unknown) => {
        if (key) {
          setPluginState(pluginSlug, key, value);
          return;
        }

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return;
        }

        Object.entries(value as Record<string, unknown>).forEach(([stateKey, stateValue]) => {
          setPluginState(pluginSlug, stateKey, stateValue);
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