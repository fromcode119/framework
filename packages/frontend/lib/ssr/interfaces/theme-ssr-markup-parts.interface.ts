/**
 * `ThemeSsrMarkup` as plain data — what crosses from a theme render host process back to the
 * storefront. Structured clone carries no class instances, so the markup is taken apart here and put
 * back together with `ThemeSsrMarkup.fromParts`.
 */
export interface IThemeSsrMarkupParts {
  bodyHtml: string;
  styleGroups: Array<{ emotionKey: string; names: string[]; css: string }>;
  imagePreloads: string[];
  pluginStyles: Array<{ key: string; css: string }>;
  rendersContentSlot: boolean;
  usedPlugins: string[];
}
