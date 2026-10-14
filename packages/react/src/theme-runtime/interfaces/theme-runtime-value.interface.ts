/**
 * What theme components need but can only get through React hooks. Read once by `ThemeProvider` and
 * published through `ThemeRuntimeContext`, so every other component in a theme stays a hook-free class.
 */
export interface IThemeRuntimeValue {
  settings: any;
  globalSettings: Record<string, any>;
  /** `ContextHooks.usePlugins()`: carries `activeTheme.variables`, the operator's theme settings. */
  plugins: any;
  /** The `org.fromcode` plugin namespace (the CMS navigation client lives here). */
  fromcode: any;
  t(key: string, vars?: Record<string, unknown>): string;
  /** The framework's active locale, never a browser sniff. */
  locale: string;
}
