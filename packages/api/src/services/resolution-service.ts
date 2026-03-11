import { PluginManager } from '@fromcode119/core';
import { type Collection, SystemConstants } from '@fromcode119/sdk';
import { RESTController } from '../controllers/rest-controller';

export class ResolutionService {
  constructor(
    private manager: PluginManager,
    private restController: RESTController
  ) {}

  async resolveSlug(slug: string, options: { 
    user?: any; 
    preview?: boolean; 
    locale?: string; 
    fallback_locale?: string;
    locale_mode?: string;
  }) {
    const rawSlug = String(slug || '').trim();
    const normalizedInput = rawSlug.startsWith('/') ? rawSlug : `/${rawSlug}`;
    const normalizedSlug = normalizedInput.replace(/^\/+/, '');
    const isRootRequest = normalizedInput === '/' || normalizedSlug === '';
    const pathSegments = normalizedSlug.split('/').filter(Boolean);

    // Fetch permalink structure
    let permalinkStructure = '/:slug';
    try {
      const settings = await this.manager.db.find(SystemConstants.TABLE.META);
      const permSetting = settings.find((s: any) => s.key === 'permalink_structure');
      if (permSetting) permalinkStructure = permSetting.value;
    } catch {}

    const structureSegments = permalinkStructure.split('/').filter(Boolean);
    const pathCandidates = Array.from(new Set([
        normalizedInput,
        normalizedSlug ? `/${normalizedSlug}` : '/',
        normalizedSlug,
        isRootRequest ? '' : undefined
    ].filter((c): c is string => c !== undefined)));

    const withLocale = (q: any) => {
      if (options.locale) q.locale = options.locale;
      if (options.fallback_locale) q.fallback_locale = options.fallback_locale;
      if (options.locale_mode) q.locale_mode = options.locale_mode;
      return q;
    };

    const activePlugins = new Set(this.manager.getPlugins().filter(p => p.state === 'active').map(p => p.manifest.slug));
    const collections = this.manager.registeredCollections;

    // 1. Priority Search (Custom Permalinks)
    for (const { collection, pluginSlug } of collections.values()) {
      if (!collection) continue;
      if (pluginSlug !== 'system' && !activePlugins.has(pluginSlug)) continue;

      if (collection.slug.startsWith('_') || collection.system) continue;
      try {
        const hasCustom = collection.fields.some(f => f.name === 'customPermalink');
        const hasPath = collection.fields.some(f => f.name === 'path');
        const hasSlug = collection.fields.some(f => f.name === 'slug');

        if (hasCustom || hasPath) {
          for (const candidate of pathCandidates) {
            const results: any = await this.restController.find(collection, {
              query: withLocale({
                [hasCustom ? 'customPermalink' : 'path']: candidate,
                limit: 1,
                preview: options.preview ? '1' : '0'
              }),
              user: options.user
            } as any);

            if (results?.docs?.length > 0) {
              return { type: collection.shortSlug || collection.slug, plugin: pluginSlug, doc: results.docs[0] };
            }
          }
        }

        if (hasSlug) {
          const slugCandidates = new Set<string>();
          if (pathSegments.length === 1) slugCandidates.add(normalizedSlug);
          if (isRootRequest) slugCandidates.add('home');

          for (const candidate of slugCandidates) {
            const results: any = await this.restController.find(collection, {
              query: withLocale({ slug: candidate, limit: 1, preview: options.preview ? '1' : '0' }),
              user: options.user
            } as any);
            if (results?.docs?.length > 0) {
              return { type: collection.shortSlug || collection.slug, plugin: pluginSlug, doc: results.docs[0] };
            }
          }
        }
      } catch {
        // Skip problematic collections so one schema mismatch cannot break route resolution.
      }
    }

    // 2. Structure Search
    for (const { collection, pluginSlug } of collections.values()) {
      if (!collection) continue;
      if (pluginSlug !== 'system' && !activePlugins.has(pluginSlug)) continue;
      
      if (collection.slug.startsWith('_') || collection.system) continue;
      try {
        let searchId: number | null = null;
        let searchSlug: string | null = null;
        const prefix = collection.shortSlug || collection.slug;
        const hasSlugField = collection.fields.some((f: any) => f?.name === 'slug');

        if (pathSegments.length > 0 && pathSegments[0] === prefix) {
          searchSlug = pathSegments.slice(1).join('/');
        } else if (pathSegments.length === structureSegments.length) {
          structureSegments.forEach((seg, idx) => {
            if (seg === ':id') {
              const val = parseInt(pathSegments[idx]);
              if (!isNaN(val)) searchId = val;
            } else if (seg === ':slug') {
              searchSlug = pathSegments[idx];
            }
          });
        }

        // Never query by slug for collections that do not have a slug field.
        // Otherwise the REST layer may ignore the unknown filter and return arbitrary records.
        if (searchSlug && !hasSlugField) {
          searchSlug = null;
        }

        if (searchId || searchSlug) {
          const query: any = withLocale({ limit: 1, preview: options.preview ? '1' : '0' });
          if (searchId) query.id = searchId;
          if (searchSlug) query.slug = searchSlug;

          const result: any = await this.restController.find(collection, { query, user: options.user } as any);
          if (result?.docs?.length > 0) {
            return { type: collection.shortSlug || collection.slug, plugin: pluginSlug, doc: result.docs[0] };
          }
        }
      } catch {}
    }

    return null;
  }
}