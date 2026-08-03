import { Context as ReactorContext } from '@fromcode119/reactor';
import type { IPluginStateContextValue } from '@react/context/interfaces/plugin-state-context-value.interface';

export class PluginStateContext {
  private static readonly defaultValue = {
  pluginState: {},
  setPluginState: () => {},
};
  static readonly Context = new ReactorContext<IPluginStateContextValue>(PluginStateContext.defaultValue).raw;
}
