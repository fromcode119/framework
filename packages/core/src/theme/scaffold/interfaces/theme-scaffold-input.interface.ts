/** What a new theme is called and says about itself. */
export interface IThemeScaffoldInput {
  /** Lowercase letters, digits and hyphens: the theme's folder, its CSS class prefix and its package name. */
  slug: string;
  name: string;
  description: string;
  /** The version `theme.json` starts at. Default `0.1.0`. */
  version?: string;
}
