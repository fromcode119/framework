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
 * Generates a preview URL for a record based on global settings and record data.
 */
export function generatePreviewUrl(
  frontendUrl: string,
  record: any,
  collection: Collection,
  permalinkStructure?: string
): string {
  if (!record || !frontendUrl) return '#';
  
  const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
  
  // PRIORITY: If we have an explicit custom permalink override, use it directly
  if (record.customPermalink) {
    return `${cleanFrontendUrl}/${record.customPermalink.startsWith('/') ? record.customPermalink.substring(1) : record.customPermalink}?preview=1&draft=1`;
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

  return `${cleanFrontendUrl}${path}?preview=1&draft=1`;
}
