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
  themeLayout?: string;
  defaultContent?: any[];
}
