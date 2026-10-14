/** The hook-derived values `ThemeProvider` reads once and hands to its view. */
export interface IThemeProviderValues {
  plugins: any;
  fromcode: any;
  settings: any;
  globalSettings: any;
  t: (key: string, ...rest: any[]) => string;
  /** The framework's active locale, from the same translation context as `t`. */
  locale: string;
}
