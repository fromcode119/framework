import { CoercionUtils, type Collection } from '@fromcode119/core';
import { RESTController } from '../../controllers/rest/rest-controller';
import { ResolutionCacheService } from './resolution-cache-service';
import type {
  ResolutionPriorityScanContext,
  ResolutionScanResult,
  ResolutionStructureScanContext,
} from './resolution-collection-scan-service.interfaces';

/**
 * The two collection scan passes of route resolution, restructured for latency WITHOUT changing
 * resolution semantics: collections are still visited strictly in registration order and the first
 * match (in candidate order within a collection) still wins — but the per-candidate `find`s inside
 * one collection now run in PARALLEL (one `Promise.allSettled` unit per collection), and the
 * structure pass batches its one-query-per-collection lookups in small ordered chunks. Result
 * selection always walks candidates/collections in their original deterministic order, so a hit is
 * identical to what the old sequential loop returned. Concurrency is bounded (one collection's
 * candidate set, or a 4-collection chunk) — never all ~35 collections at once.
 */
export class ResolutionCollectionScanService {
  private static readonly STRUCTURE_CHUNK_SIZE = 4;

  constructor(
    private readonly db: any,
    private readonly restController: RESTController,
    private readonly cache: ResolutionCacheService,
  ) {}

  /** Pass 1 — custom permalinks first, then exact slugs, per collection in order. */
  async scanPriority(ctx: ResolutionPriorityScanContext): Promise<ResolutionScanResult | null> {
    const previewFlag = ctx.options.preview ? '1' : '0';
    for (const { collection, pluginSlug } of ctx.entries) {
      const flags = this.cache.getCollectionFlags(collection);
      const finds: Array<{ kind: 'custom' | 'slug'; candidate: string; query: any }> = [];
      if (flags.hasCustomPermalink) {
        for (const candidate of ctx.pathCandidates) {
          finds.push({ kind: 'custom', candidate, query: ctx.withLocale({ customPermalink: candidate, limit: 1, preview: previewFlag }) });
        }
      }
      if (flags.hasSlug) {
        for (const candidate of ctx.slugCandidates) {
          finds.push({ kind: 'slug', candidate, query: ctx.withLocale({ slug: candidate, limit: 1, preview: previewFlag }) });
        }
      }
      if (finds.length === 0) continue;

      const settled = await Promise.allSettled(
        finds.map((f) => this.restController.find(collection, { query: f.query, user: ctx.options.user } as any)),
      );
      for (let i = 0; i < finds.length; i++) {
        const outcome = settled[i];
        const doc = outcome.status === 'fulfilled' ? (outcome.value as any)?.docs?.[0] : undefined;
        if (!doc) continue;
        if (await this.isPermalinkDisabled(collection, doc.id, !!ctx.options.preview)) continue;
        const f = finds[i];
        return {
          type: collection.shortSlug || collection.slug,
          plugin: pluginSlug,
          doc: f.kind === 'custom' ? ctx.presentCustom(doc, collection) : ctx.presentSlug(doc, collection, f.candidate),
        };
      }
    }
    return null;
  }

  /** Pass 2 — permalink-structure search, one query per collection, batched in ordered chunks. */
  async scanStructure(ctx: ResolutionStructureScanContext): Promise<ResolutionScanResult | null> {
    const jobs: Array<{ collection: Collection; pluginSlug: string; query: any }> = [];
    for (const { collection, pluginSlug } of ctx.entries) {
      const query = this.buildStructureQuery(collection, ctx);
      if (query) jobs.push({ collection, pluginSlug, query });
    }

    for (let i = 0; i < jobs.length; i += ResolutionCollectionScanService.STRUCTURE_CHUNK_SIZE) {
      const chunk = jobs.slice(i, i + ResolutionCollectionScanService.STRUCTURE_CHUNK_SIZE);
      const settled = await Promise.allSettled(
        chunk.map((j) => this.restController.find(j.collection, { query: j.query, user: ctx.options.user } as any)),
      );
      for (let k = 0; k < chunk.length; k++) {
        const outcome = settled[k];
        const doc = outcome.status === 'fulfilled' ? (outcome.value as any)?.docs?.[0] : undefined;
        if (!doc) continue;
        if (await this.isPermalinkDisabled(chunk[k].collection, doc.id, !!ctx.options.preview)) continue;
        return { type: chunk[k].collection.shortSlug || chunk[k].collection.slug, plugin: chunk[k].pluginSlug, doc };
      }
    }
    return null;
  }

  async isPermalinkDisabled(collection: Collection, docId: any, preview: boolean): Promise<boolean> {
    if (preview) return false;
    if (docId === null || docId === undefined || docId === '') return false;
    try {
      const pk = collection.primaryKey || 'id';
      const raw = await this.db.findOne(collection.tableName || collection.slug, { [pk]: docId });
      return CoercionUtils.toBoolean(raw?.disablePermalink ?? raw?.disable_permalink, false) === true;
    } catch {
      return false;
    }
  }

  private buildStructureQuery(collection: Collection, ctx: ResolutionStructureScanContext): any | null {
    let searchId: number | null = null;
    let searchSlug: string | null = null;
    const prefix = collection.shortSlug || collection.slug;
    const hasSlugField = this.cache.getCollectionFlags(collection).hasSlug;

    if (ctx.pathSegments.length > 0 && ctx.pathSegments[0] === prefix) {
      searchSlug = ctx.pathSegments.slice(1).join('/');
    } else if (ctx.pathSegments.length === ctx.structureSegments.length) {
      ctx.structureSegments.forEach((seg, idx) => {
        if (seg === ':id') {
          const val = parseInt(ctx.pathSegments[idx]);
          if (!isNaN(val)) searchId = val;
        } else if (seg === ':slug') {
          searchSlug = ctx.pathSegments[idx];
        }
      });
    }

    // Never query by slug for collections that do not have a slug field.
    // Otherwise the REST layer may ignore the unknown filter and return arbitrary records.
    if (searchSlug && !hasSlugField) {
      searchSlug = null;
    }

    if (!searchId && !searchSlug) return null;
    const query: any = ctx.withLocale({ limit: 1, preview: ctx.options.preview ? '1' : '0' });
    if (searchId) query.id = searchId;
    if (searchSlug) query.slug = searchSlug;
    return query;
  }
}
