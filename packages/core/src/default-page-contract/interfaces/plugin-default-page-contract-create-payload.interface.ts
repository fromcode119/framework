export interface IPluginDefaultPageContractCreatePayload {
  canonicalKey: string;
  namespace: string;
  pluginSlug: string;
  key: string;
  slug: string;
  customPermalink: string;
  aliases: string[];
  recipe: string;
  title?: string;
  /** See `IPluginDefaultPageContract.titleKey`. Absent when a theme override set the title. */
  titleKey?: string;
  themeLayout?: string;
  defaultContent?: any[];
  /** See `IPluginDefaultPageContract.contentValues`. */
  contentValues?: string;
}
