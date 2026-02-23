import { Collection, resolveCollection as coreResolveCollection, generatePreviewUrl as coreGeneratePreviewUrl } from '@fromcode119/core';

export { coreResolveCollection as resolveCollection };

/**
 * Resolves the collection-specific prefix from settings.
 */
export function getCollectionPrefix(collection: Collection, pluginSettings?: Record<string, any>): string {
  if (!pluginSettings || !collection.admin?.previewPrefixSettingsKey) return '';
  
  const prefixKey = collection.admin.previewPrefixSettingsKey;
  if (!pluginSettings[prefixKey]) return '';
  
  return String(pluginSettings[prefixKey]).replace(/^\//, '').replace(/\/$/, '');
}

/**
 * Generates a preview URL for a record based on global settings and record data.
 */
export function generatePreviewUrl(
  frontendUrl: string,
  record: any,
  collection: Collection,
  permalinkStructure?: string,
  pluginSettings?: Record<string, any>
): string {
  const prefix = getCollectionPrefix(collection, pluginSettings);
  return coreGeneratePreviewUrl(frontendUrl, record, collection, {
    permalinkStructure,
    prefix
  });
}
