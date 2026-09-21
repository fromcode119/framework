import { ICollection, CollectionIdentityService } from '@fromcode119/core/client';

/**
 * Resolves the collection-specific prefix from settings.
 */
export class AdminCollectionUtils {
  private static readonly collectionIdentityService = new CollectionIdentityService();

  /**
   * Whether this collection's records have a PUBLIC PAGE the operator can be shown a link to.
   *
   * A `slug` field is NOT that proof, and used to be treated as it: every collection with a slug —
   * staff, tax classes, shipping zones, marketplace listings — got a "Preview & Permalink" card
   * advertising `<site>/<slug>`, a URL built from a hardcoded `/:slug` fallback that nothing serves.
   * Seventeen collections had each added `admin.preview: false` to silence it one at a time, and the
   * eleven that had not were still showing operators a link that 404s.
   *
   * So the public page must be DECLARED: either `admin.previewPrefixSettingsKey` (the setting that
   * holds the route's prefix — what every collection with a real detail page already sets) or an
   * explicit `admin.preview: true` for one that serves at the site root with no prefix setting.
   * `admin.preview: false` still wins outright, so the existing opt-outs keep working.
   */
  static supportsPreview(collection?: ICollection | null): boolean {
    const admin = collection?.admin as any;
    if (!collection || admin?.preview === false) {
      return false;
    }

    const hasSlug = Array.isArray((collection as any).fields)
      && (collection as any).fields.some((field: any) => field?.name === 'slug');
    if (!hasSlug) {
      return false;
    }

    return admin?.preview === true || Boolean(admin?.previewPrefixSettingsKey);
  }

  static getCollectionPrefix(collection: ICollection, pluginSettings?: Record<string, any>): string {
    if (!pluginSettings || !collection.admin?.previewPrefixSettingsKey) return '';
    const prefixKey = collection.admin.previewPrefixSettingsKey;
    if (!pluginSettings[prefixKey]) return '';
    return String(pluginSettings[prefixKey]).replace(/^\//, '').replace(/\/$/, '');
  }

  static generatePreviewUrl(
    frontendUrl: string,
    record: any,
    collection: ICollection,
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

  static resolveCollection(collections: ICollection[], pluginSlug: string, slug: string): ICollection | undefined {
    const normPluginSlug = String(pluginSlug || 'system').toLowerCase();
    const isGlobalCollectionRoute = normPluginSlug === 'collections';
    const requestedPluginSlug = isGlobalCollectionRoute ? undefined : normPluginSlug;
    const resolvedSlug = AdminCollectionUtils.collectionIdentityService.resolveRegisteredSlug(slug, collections as any, requestedPluginSlug);
    const normalizedResolvedSlug = String(resolvedSlug || '').toLowerCase();

    return collections.find((collection) => {
      if (String(collection.slug || '').toLowerCase() !== normalizedResolvedSlug) {
        return false;
      }

      if (isGlobalCollectionRoute) {
        return true;
      }

      return String((collection as any).pluginSlug || 'system').toLowerCase() === normPluginSlug;
    });
  }
}
