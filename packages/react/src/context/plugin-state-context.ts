import React from 'react';
import type { PluginStateContextValue } from './plugin-state-context.interfaces';

const defaultValue: PluginStateContextValue = {
  pluginState: {},
  setPluginState: () => {},
};

export class PluginStateContext {
  static readonly Context = React.createContext<PluginStateContextValue>(defaultValue);
}
