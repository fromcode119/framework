import React from 'react';

export interface PluginStateContextValue {
  pluginState: Record<string, Record<string, any>>;
  setPluginState: (pluginSlug: string, key: string, value: any) => void;
}

const defaultValue: PluginStateContextValue = {
  pluginState: {},
  setPluginState: () => {},
};

export class PluginStateContext {
  static readonly Context = React.createContext<PluginStateContextValue>(defaultValue);
}
