import { CoreServices, PluginManager, type IResolvedPluginDefaultPageContract, ThemeManager, SystemConstants, type ICollection, PluginState } from '@fromcode119/core';
import { RESTController } from '@api/controllers/rest/rest-controller';
import { ResolutionContractMatchService } from '@api/services/helpers/resolution-contract-match-service';
import { ResolutionContractPresentationService } from '@api/services/helpers/resolution-contract-presentation-service';
import { ResolutionContractPathService } from '@api/services/helpers/resolution-contract-path-service';
import { ResolutionCacheService } from '@api/services/helpers/resolution-cache-service';
import { ResolutionCollectionScanService } from '@api/services/helpers/resolution-collection-scan-service';
import type { IResolutionScanEntry } from '@api/services/helpers/interfaces/resolution-scan-entry.interface';
import { PluginDefaultPageContractMaterializationMode } from '@fromcode119/core';
import { PluginDefaultPageContractResolutionStatus } from '@fromcode119/core';

export class ResolutionService {
  private readonly contractMatcher: ResolutionContractMatchService;
  private readonly cache: ResolutionCacheService;
  private readonly scanner: ResolutionCollectionScanService;

  constructor(
    private manager: PluginManager,
    private themeManager: ThemeManager,
    private restController: RESTController
  ) {
    this.contractMatcher = new ResolutionContractMatchService(restController);
    this.cache = new ResolutionCacheService();
    this.scanner = new ResolutionCollectionScanService((manager as any)?.db, restController, this.cache);
    this.subscribeCacheInvalidation();
  }

  /**
   * Invalidate cached resolutions on every collection write (created/updated arrive as `saved`)
   * and everything — including the cached permalink structure — on a settings change. Whole-cache
   * clears are deliberate: resolution is cross-collection, so per-key invalidation cannot be safe.
   */
  private subscribeCacheInvalidation() {
    const hooks = (this.manager as any)?.hooks;
    if (!hooks) return;
    hooks.on('collection:*:saved', () => this.cache.invalidateResults());
    hooks.on('collection:*:deleted', () => this.cache.invalidateResults());
    hooks.on('system:settings:updated', () => this.cache.invalidateAll());
  }

  async resolveSlug(slug: string, options: {
    user?: any;
    preview?: boolean;
    locale?: string;
    fallback_locale?: string;
    locale_mode?: string;
  }) {
    const resolved = await this.resolveSlugRaw(slug, options);
    // Run the resolved document through any plugin-registered content-resolution
    // gates (e.g. members-only paywall gating). The framework holds no knowledge
    // of what the gates do; plugins register them via CoreServices during onInit.
    // NOTE: gates run per-request with the visitor's identity — the raw-resolution
    // cache below deliberately sits BEFORE this step and never short-circuits it.
    const gated = await CoreServices.getInstance().contentResolutionGates.apply(resolved, {
      user: options.user,
      preview: options.preview,
    });
    if (gated) return gated;

    // Nothing resolved to content — consult plugin-registered redirect resolvers
    // (e.g. an SEO plugin's retired-URL rules) before returning null. The framework
    // stays plugin-agnostic: it only asks the registry and shapes a redirect result.
    const redirect = await this.resolveRedirect(slug);
    if (redirect) {
      return { type: 'redirect', plugin: '', doc: null, redirect };
    }
    return gated;
  }

  private async resolveRedirect(slug: string): Promise<{ target: string; permanent: boolean } | null> {
    const rawSlug = String(slug || '').trim();
    const path = rawSlug.startsWith('/') ? rawSlug : `/${rawSlug.replace(/^\/+/, '')}`;
    return CoreServices.getInstance().redirectResolvers.resolve(path);
  }

  /**
   * Raw (pre-gate) slug resolution with an anonymous-only result cache. Authenticated or preview
   * requests bypass the cache entirely (no read, no write) — see ResolutionCacheService.
   */
  private async resolveSlugRaw(slug: string, options: {
    user?: any;
    preview?: boolean;
    locale?: string;
    fallback_locale?: string;
    locale_mode?: string;
  }) {
    const rawSlug = String(slug || '').trim();
    const normalizedInput = rawSlug.startsWith('/') ? rawSlug : `/${rawSlug}`;

    const cacheable = this.cache.isCacheable(options);
    const cacheKey = this.cache.buildKey(normalizedInput, options);
    if (cacheable) {
      const hit = this.cache.getResult(cacheKey);
      if (hit) return hit.value;
    }

    const resolved = await this.resolveSlugUncached(normalizedInput, options);
    if (cacheable) this.cache.setResult(cacheKey, resolved ?? null);
    return resolved;
  }

  private async resolveSlugUncached(normalizedInput: string, options: {
    user?: any;
    preview?: boolean;
    locale?: string;
    fallback_locale?: string;
    locale_mode?: string;
  }) {
    const normalizedSlug = normalizedInput.replace(/^\/+/, '');
    const isRootRequest = normalizedInput === '/' || normalizedSlug === '';
    const pathSegments = normalizedSlug.split('/').filter(Boolean);

    const permalinkStructure = await this.cache.getPermalinkStructure(() => this.loadPermalinkStructure());

    const structureSegments = permalinkStructure.split('/').filter(Boolean);
    const pathCandidates = Array.from(new Set([
        normalizedInput,
        normalizedSlug ? `/${normalizedSlug}` : '/',
        normalizedSlug,
        isRootRequest ? '' : undefined
    ].filter((c): c is string => c !== undefined)));

    const slugCandidates = new Set<string>();
    if (pathSegments.length === 1) slugCandidates.add(normalizedSlug);
    if (isRootRequest) slugCandidates.add('home');

    const withLocale = (q: any) => {
      if (options.locale) q.locale = options.locale;
      if (options.fallback_locale) q.fallback_locale = options.fallback_locale;
      if (options.locale_mode) q.locale_mode = options.locale_mode;
      return q;
    };

    const resolvedContracts = await this.resolveDefaultPageContracts();

    const activePlugins = new Set(this.manager.getPlugins().filter(p => p.state === PluginState.ACTIVE).map(p => p.manifest.slug));
    const collections = this.manager.registeredCollections;
    const entries: IResolutionScanEntry[] = [];
    for (const { collection, pluginSlug } of collections.values()) {
      if (!collection) continue;
      if (pluginSlug !== 'system' && !activePlugins.has(pluginSlug)) continue;
      if (collection.slug.startsWith('_') || collection.system) continue;
      entries.push({ collection, pluginSlug });
    }

    // 1. Priority Search (Custom Permalinks, then exact slugs)
    const priorityMatch = await this.scanner.scanPriority({
      entries,
      options,
      withLocale,
      pathCandidates,
      slugCandidates: Array.from(slugCandidates),
      presentCustom: (doc, collection) =>
        this.applyExactPageContractPresentation(doc, collection, normalizedInput, resolvedContracts),
      presentSlug: (doc, collection, candidate) =>
        ResolutionService.withResolvedSlug(
          this.applyExactPageContractPresentation(doc, collection, normalizedInput, resolvedContracts),
          candidate,
        ),
    });
    if (priorityMatch) return priorityMatch;

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
      if (contractCollection && await this.scanner.isPermalinkDisabled(contractCollection, contractMatch.doc?.id, !!options.preview)) {
        return null;
      }
      return contractMatch;
    }

    // 2. Structure Search
    return this.scanner.scanStructure({ entries, options, withLocale, pathSegments, structureSegments });
  }

  private async loadPermalinkStructure(): Promise<string> {
    try {
      const settings = await this.manager.db.find(SystemConstants.TABLE.META);
      const permSetting = settings.find((s: any) => s.key === 'permalink_structure');
      if (permSetting) return permSetting.value;
    } catch {}
    return '/:slug';
  }

  private async resolveDefaultPageContracts() {
    const overrides = await this.themeManager.getActiveThemeDefaultPageContractOverrides();
    return CoreServices.getInstance().defaultPageContractResolution.resolveAll({ overrides });
  }

  private findResolvedCollection(
    collections: Map<string, { collection: ICollection; pluginSlug: string }>,
    type: string,
    plugin: string,
  ): ICollection | null {
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

  /**
   * Guarantee the resolved document reports the slug it was matched by. Route resolution is a contract:
   * "this path resolved to this document" — consumers (the frontend layout/router) key off `doc.slug`,
   * so it must never be absent just because a collection marked the field hidden for its admin form.
   * Only fills a MISSING slug; never overwrites the document's own value.
   */
  private static withResolvedSlug(doc: any, resolvedSlug: string): any {
    if (!doc || typeof doc !== 'object') return doc;
    const existing = String(doc.slug ?? '').trim();
    if (existing) return doc;
    const fallback = String(resolvedSlug ?? '').trim();
    return fallback ? { ...doc, slug: fallback } : doc;
  }

  private applyExactPageContractPresentation(
    doc: any,
    collection: ICollection,
    normalizedInput: string,
    resolvedContracts: IResolvedPluginDefaultPageContract[],
  ): any {
    if (!doc || typeof doc !== 'object') {
      return doc;
    }

    const collectionType = String(collection.shortSlug || collection.slug || '').trim();
    if (collectionType !== 'pages') {
      return doc;
    }

    const matchingContract = resolvedContracts.find((contract) => this.isMatchingSingletonContract(contract, normalizedInput));
    if (!matchingContract) {
      return doc;
    }

    if (matchingContract.effectiveThemeLayout && !doc.themeLayout && !doc.pageTemplate) {
      return ResolutionContractPresentationService.applyToDoc(doc, matchingContract);
    }

    if (matchingContract.effectiveTitle && (!doc.title || !String(doc.title).trim()) && (!doc.name || !String(doc.name).trim())) {
      return ResolutionContractPresentationService.applyToDoc(doc, matchingContract);
    }

    return doc;
  }

  private isMatchingSingletonContract(
    contract: IResolvedPluginDefaultPageContract,
    normalizedInput: string,
  ): boolean {
    if (!contract.install || contract.status !== PluginDefaultPageContractResolutionStatus.READY) {
      return false;
    }

    if (contract.materializationMode !== PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT) {
      return false;
    }

    const matchingPattern = ResolutionContractPathService.findMatchingPattern(contract, normalizedInput);
    if (!matchingPattern) {
      return false;
    }

    return !ResolutionContractPathService.hasPathParameters(matchingPattern);
  }
}
