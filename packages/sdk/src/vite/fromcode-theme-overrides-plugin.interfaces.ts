export interface FromcodeThemeOverridesOptions {
  /**
   * Absolute path to the theme's src directory.
   * Defaults to `process.cwd() + '/src'`.
   */
  srcDir?: string;

  /** Theme slug registered in the framework. */
  themeSlug: string;

  /**
   * Override registration priority.
   * Theme overrides should be higher than plugin defaults (plugin = 10, theme = 11).
   * Defaults to 11.
   */
  priority?: number;

  /**
   * Path to the theme entry file that receives the auto-injected import.
   * Relative to srcDir. Defaults to `'index.jsx'`.
   */
  entry?: string;

}
