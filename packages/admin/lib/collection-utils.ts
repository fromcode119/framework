import { Collection } from '@fromcode119/sdk';

/**
 * Resolves the collection-specific prefix from settings.
 */
export class AdminCollectionUtils {
  static getCollectionPrefix(collection: Collection, pluginSettings?: Record<string, any>): string {
    if (!pluginSettings || !collection.admin?.previewPrefixSettingsKey) return '';
    const prefixKey = collection.admin.previewPrefixSettingsKey;
    if (!pluginSettings[prefixKey]) return '';
    return String(pluginSettings[prefixKey]).replace(/^\//, '').replace(/\/$/, '');
  }

  static generatePreviewUrl(
    frontendUrl: string,
    record: any,
    collection: Collection,
    permalinkStructure?: string,
    pluginSettings?: Record<string, any>
  ): string {
    if (!record || !frontendUrl) return '#';
    const cleanBaseUrl = frontendUrl.replace(/\/$/, '');
    const prefix = AdminCollectionUtils.getCollectionPrefix(collection, pluginSettings);

    if (record.customPermalink) {
      const raw = String(record.customPermalink || '').trim();
      const isAbsolute = raw.startsWith('/');
      let path = raw.replace(/^\/+/, '');
      if (!isAbsolute && prefix && !path.startsWith(prefix + '/')) {
        path = `${prefix}/${path}`.replace(/\/+/g, '/');
      }
      return `${cleanBaseUrl}/${path.startsWith('/') ? path.substring(1) : path}?preview=1`;
    }

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
    Object.entries(replacements).forEach(([key, val]) => { path = path.replace(key, val); });
    path = path.replace(/\/+/g, '/');
    if (!path.startsWith('/')) path = '/' + path;
    if (prefix) path = `/${prefix}${path}`;

    return `${cleanBaseUrl}${path}?preview=1`;
  }

  static resolveCollection(collections: Collection[], pluginSlug: string, slug: string): Collection | undefined {
    const normSlug = String(slug || '').toLowerCase();
    const normPluginSlug = String(pluginSlug || 'system').toLowerCase();
    return collections.find(c => {
      const isSlugMatch =
        String((c as any).shortSlug || '').toLowerCase() === normSlug ||
        String(c.slug || '').toLowerCase() === normSlug ||
        String((c as any).unprefixedSlug || '').toLowerCase() === normSlug;
      const isPluginMatch = String((c as any).pluginSlug || 'system').toLowerCase() === normPluginSlug;
      return isSlugMatch && isPluginMatch;
    });
  }
}