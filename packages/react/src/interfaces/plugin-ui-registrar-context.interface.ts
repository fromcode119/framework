/** Context the plugin-UI entry template supplies to {@link PluginUiRegistrar} for each export. */
export interface IPluginUiRegistrarContext {
  pluginSlug: string;
  namespace: string;
  /**
   * The raw bundle scope — `'admin'` or `'frontend'`.
   *
   * A plain string, NOT `UiScope`. The entry receives it from the Vite config's `define`, which
   * substitutes a JSON string literal, so no `Enum` instance exists at that boundary — and the entry is
   * copied verbatim into each plugin, so it cannot import one either. `PluginUiRegistrar` compares it
   * against an override's own raw `scope` string, so both sides stay strings and the comparison holds.
   */
  uiBundle: string;
}
