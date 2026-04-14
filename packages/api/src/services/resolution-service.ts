import {
  CoreServices,
  CoercionUtils,
  PluginManager,
  ThemeManager,
  SystemConstants,
  type Collection,
} from '@fromcode119/core';
import { RESTController } from '../controllers/rest-controller';
import { ResolutionContractMatchService } from './helpers/resolution-contract-match-service';

export class ResolutionService {
  private readonly contractMatcher: ResolutionContractMatchService;

  constructor(
    private manager: PluginManager,
    private themeManager: ThemeManager,
    private restController: RESTController
  ) {
    this.contractMatcher = new ResolutionContractMatchService(restController);
  }

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

    const resolvedContracts = await this.resolveDefaultPageContracts();

    const activePlugins = new Set(this.manager.getPlugins().filter(p => p.state === 'active').map(p => p.manifest.slug));
    const collections = this.manager.registeredCollections;

    // 1. Priority Search (Custom Permalinks)
    for (const { collection, pluginSlug } of collections.values()) {
      if (!collection) continue;
      if (pluginSlug !== 'system' && !activePlugins.has(pluginSlug)) continue;

      if (collection.slug.startsWith('_') || collection.system) continue;
      try {
        const hasCustom = collection.fields.some(f => f.name === 'customPermalink');
        const hasSlug = collection.fields.some(f => f.name === 'slug');

        if (hasCustom) {
          for (const candidate of pathCandidates) {
            const results: any = await this.restController.find(collection, {
              query: withLocale({
                customPermalink: candidate,
                limit: 1,
                preview: options.preview ? '1' : '0'
              }),
              user: options.user
            } as any);

            if (results?.docs?.length > 0) {
              const doc = results.docs[0];
              if (await this.isPermalinkDisabled(collection, doc.id, !!options.preview)) continue;
              return { type: collection.shortSlug || collection.slug, plugin: pluginSlug, doc };
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
              const doc = results.docs[0];
              if (await this.isPermalinkDisabled(collection, doc.id, !!options.preview)) continue;
              return { type: collection.shortSlug || collection.slug, plugin: pluginSlug, doc };
            }
          }
        }
      } catch {
        // Skip problematic collections so one schema mismatch cannot break route resolution.
      }
    }

    const contractMatch = await this.contractMatcher.resolve(
      normalizedInput,
      resolvedContracts,
      collections,
      activePlugins,
      withLocale,
      options,
    );
    if (contractMatch) {
      const contractCollection = this.findResolvedCollection(collections, contractMatch.type, contractMatch.plugin);
      if (contractCollection && await this.isPermalinkDisabled(contractCollection, contractMatch.doc?.id, !!options.preview)) {
        return null;
      }
      return contractMatch;
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
            const doc = result.docs[0];
            if (await this.isPermalinkDisabled(collection, doc.id, !!options.preview)) continue;
            return { type: collection.shortSlug || collection.slug, plugin: pluginSlug, doc };
          }
        }
      } catch {}
    }

    return null;
  }

  private async resolveDefaultPageContracts() {
    const overrides = await this.themeManager.getActiveThemeDefaultPageContractOverrides();
    return CoreServices.getInstance().defaultPageContractResolution.resolveAll({ overrides });
  }

  private findResolvedCollection(
    collections: Map<string, { collection: Collection; pluginSlug: string }>,
    type: string,
    plugin: string,
  ): Collection | null {
    for (const { collection, pluginSlug } of collections.values()) {
      if (!collection || pluginSlug !== plugin) {
        continue;
      }

      const collectionType = collection.shortSlug || collection.slug;
      if (collectionType === type) {
        return collection;
      }
    }

    return null;
  }

  private async isPermalinkDisabled(collection: Collection, docId: any, preview: boolean): Promise<boolean> {
    if (preview) return false;
    if (docId === null || docId === undefined || docId === '') return false;
    try {
      const pk = collection.primaryKey || 'id';
      const raw = await this.manager.db.findOne(collection.tableName || collection.slug, { [pk]: docId });
      return CoercionUtils.toBoolean(raw?.disablePermalink ?? raw?.disable_permalink, false) === true;
    } catch {
      return false;
    }
  }
}