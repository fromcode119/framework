import { Collection } from '@fromcode/core';

/**
 * Resolves a collection from the system manifest based on URL slugs.
 * Handles framework-prefixed Slugs, shortSlugs and plugin context.
 */
export function resolveCollection(
  collections: Collection[], 
  pluginSlug: string, 
  slug: string
): Collection | undefined {
  return collections.find(c => {
    // Check if the actual collection slug (prefixed) matches the URL slug (short)
    const isSlugMatch = c.shortSlug === slug || c.slug === slug || c.unprefixedSlug === slug;
    
    const isPluginMatch = c.pluginSlug === pluginSlug;
    return isSlugMatch && isPluginMatch;
  });
}

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
  if (!record || !frontendUrl) return '#';
  
  const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
  const prefix = getCollectionPrefix(collection, pluginSettings);
  
  // PRIORITY: If we have an explicit custom permalink override, use it
  if (record.customPermalink) {
    let path = record.customPermalink.startsWith('/') ? record.customPermalink.substring(1) : record.customPermalink;
    
    // If we have a collection prefix, and the custom permalink doesn't already start with it, prepend it
    // This ensures consistency between UI display and actual preview URL
    if (prefix && !path.startsWith(prefix + '/')) {
      path = `${prefix}/${path}`.replace(/\/+/g, '/');
    }

    return `${cleanFrontendUrl}/${path.startsWith('/') ? path.substring(1) : path}?preview=1&draft=1`;
  }

  // FALLBACK: Use the global structure logic
  const idValue = record.id || 'new';
  const pathValue = record.slug || idValue;
  const structure = permalinkStructure || '/:slug';
  
  const now = new Date(record.createdAt || Date.now());
  const replacements: Record<string, string> = {
    ':year': now.getFullYear().toString(),
    ':month': (now.getMonth() + 1).toString().padStart(2, '0'),
    ':day': now.getDate().toString().padStart(2, '0'),
    ':id': String(idValue),
    ':slug': String(pathValue),
  };

  let path = structure;
  Object.entries(replacements).forEach(([key, val]) => {
    path = path.replace(key, val);
  });

  // Clean up double slashes and ensure leading slash
  path = path.replace(/\/+/g, '/');
  if (!path.startsWith('/')) path = '/' + path;

  // Prepend the collection-specific prefix
  if (prefix) {
    path = `/${prefix}${path}`;
  }

  return `${cleanFrontendUrl}${path}?preview=1&draft=1`;
}
