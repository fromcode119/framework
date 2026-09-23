/** The plugin design a storefront page shows while it has no content of its own. */
export interface IPageDesign {
  pluginSlug: string;
  /** The plugin's own display name, from its manifest. */
  pluginName: string;
  /** The contract's name for the page ("Cookies Policy"), when it declares one. */
  title: string;
}
