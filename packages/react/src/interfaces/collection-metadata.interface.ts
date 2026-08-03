export interface ICollectionMetadata {
  slug: string;
  shortSlug?: string;
  unprefixedSlug?: string;
  pluginSlug?: string;
  name?: string;
  fields: any[];
  admin?: any;
}
