export interface IPluginStateContextValue {
  pluginState: Record<string, Record<string, any>>;
  setPluginState: (pluginSlug: string, key: string, value: any) => void;
}
