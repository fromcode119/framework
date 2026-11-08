import { RequestServerTiming } from '@fromcode119/core';
import { ResolutionMatchKind } from '@api/services/helpers/enums/resolution-match-kind.enum';
import { CoercionUtils, type ICollection } from '@fromcode119/core';
import { RESTController } from '@api/controllers/rest/rest-controller';
import { QueryHelper } from '@api/services/query-helper';
import { CollectionReadRedaction } from '@api/services/collection-read-redaction';
import { ResolutionCacheService } from '@api/services/helpers/resolution-cache-service';
import { CollectionAccessPolicyService } from '@api/services/collection-access-policy-service';
import type { IResolutionPriorityScanContext } from '@api/services/helpers/interfaces/resolution-priority-scan-context.interface';
import type { IResolutionScanResult } from '@api/services/helpers/interfaces/resolution-scan-result.interface';
import type { IResolutionStructureScanContext } from '@api/services/helpers/interfaces/resolution-structure-scan-context.interface';
/**
 * The two collection scan passes of route resolution, restructured for latency WITHOUT changing
 * resolution semantics: collections are still visited strictly in registration order and the first
 * match (in candidate order within a collection) still wins — but the per-candidate `find`s inside
 * one collection now run in PARALLEL (one `Promise.allSettled` unit per collection), and the
 * structure pass batches its one-query-per-collection lookups in small ordered chunks. Result
 * selection always walks candidates/collections in their original deterministic order, so a hit is
 * identical to what the old sequential loop returned. Concurrency is bounded (one collection's
 * candidate set, or a 4-collection chunk) — never all ~35 collections at once.
 *
 * These scans carry NO `preview` query parameter. Whether unpublished records are visible is decided
 * by the identity in `options.user`, which is what `restController.find` reads — a `preview: '1'` in
 * the query would be a second, request-shaped way to ask for drafts, and that is exactly the channel
 * an anonymous `?preview=1` used to travel down. `options.preview` still gates the permalink checks
 * below, which are about routability, not about who may read the record.
 *
 * A collection the visitor may not read is not asked at all. Its `find` could only be refused, so the
 * answer is the same — but every anonymous page lookup used to send one refused query per candidate
 * path to each such collection (a form list, say) and log each refusal.
 */
export class ResolutionCollectionScanService {
  private static readonly STRUCTURE_CHUNK_SIZE = 4;
  /** Collections asked at once in pass 1. Each asks up to three candidates, so at most six queries are in flight. */
  private static readonly PRIORITY_CHUNK_SIZE = 2;
  private readonly accessPolicy = new CollectionAccessPolicyService();

  constructor(
    private readonly db: any,
    private readonly restController: RESTController,
    private readonly cache: ResolutionCacheService,
  ) {}

  /** Pass 1 — custom permalinks first, then exact slugs, per collection in order. */
  async scanPriority(ctx: IResolutionPriorityScanContext): Promise<IResolutionScanResult | null> {
    // Collections are asked in ordered CHUNKS, not one after another. A path no collection holds — a
    // 404, or a framework page such as /login — visited every collection serially, and on a site with a
    // dozen collections that was ~300 ms before the not-found page could start. Within a chunk every
    // collection is asked at once; the answers are still read in the original order, and a later chunk
    // runs only when no earlier one matched, so the first collection to claim a path still wins.
    const chunkSize = ResolutionCollectionScanService.PRIORITY_CHUNK_SIZE;
    for (let i = 0; i < ctx.entries.length; i += chunkSize) {
      const chunk = ctx.entries.slice(i, i + chunkSize);
      // Summed over the collections asked at once, so its total is work, not wall time (the step around the scan is that).
      const answers = await Promise.all(chunk.map((entry) => RequestServerTiming.step('resolve-collection', () => this.priorityCandidates(entry.collection, ctx))));
      for (let k = 0; k < chunk.length; k++) {
        const { collection, pluginSlug } = chunk[k];
        for (const { find, doc } of answers[k]) {
          if (await this.isPermalinkDisabled(collection, doc.id, !!ctx.options.preview)) continue;
          return {
            type: collection.shortSlug || collection.slug,
            plugin: pluginSlug,
            doc: find.kind === ResolutionMatchKind.CUSTOM ? ctx.presentCustom(doc, collection) : ctx.presentSlug(doc, collection, find.candidate),
          };
        }
      }
    }
    return null;
  }

  /** One collection's priority lookups (custom permalink, then slug), in candidate order, matches only. */
  private async priorityCandidates(
    collection: ICollection,
    ctx: IResolutionPriorityScanContext,
  ): Promise<Array<{ find: { kind: ResolutionMatchKind; candidate: string }; doc: any }>> {
    const flags = this.cache.getCollectionFlags(collection);
    const finds: Array<{ kind: ResolutionMatchKind; candidate: string; query: any }> = [];
    if (flags.hasCustomPermalink) {
      for (const candidate of ctx.pathCandidates) {
        finds.push({ kind: ResolutionMatchKind.CUSTOM, candidate, query: ctx.withLocale({ customPermalink: candidate, limit: 1 }) });
      }
    }
    if (flags.hasSlug) {
      for (const candidate of ctx.slugCandidates) {
        finds.push({ kind: ResolutionMatchKind.SLUG, candidate, query: ctx.withLocale({ slug: candidate, limit: 1 }) });
      }
    }
    // Readability is asked only of a collection that has something to look up: the answer can cost a
    // round trip to the plugin's process, and most collections hold neither a slug nor a permalink.
    if (finds.length === 0) return [];
    if (!(await this.anyRowHolds(collection, finds))) return [];
    if (!(await this.readable(collection, ctx.options.user))) return [];
    const settled = await Promise.allSettled(
      finds.map((f) => this.restController.find(collection, { query: f.query, user: ctx.options.user, [CollectionReadRedaction.FOR_RESOLUTION]: true } as any)),
    );
    const matches: Array<{ find: { kind: ResolutionMatchKind; candidate: string }; doc: any }> = [];
    for (let i = 0; i < finds.length; i++) {
      const outcome = settled[i];
      const doc = outcome.status === 'fulfilled' ? (outcome.value as any)?.docs?.[0] : undefined;
      if (doc) matches.push({ find: finds[i], doc });
    }
    return matches;
  }

  /** Pass 2 — permalink-structure search, one query per collection, batched in ordered chunks. */
  async scanStructure(ctx: IResolutionStructureScanContext): Promise<IResolutionScanResult | null> {
    // The query is built FIRST: most collections have nothing to look up for this path, and asking
    // whether a collection is readable can cost a round trip to its plugin's process. Those that do
    // have a lookup are asked together, not one after another.
    const candidates: Array<{ collection: ICollection; pluginSlug: string; query: any }> = [];
    for (const { collection, pluginSlug } of ctx.entries) {
      const query = this.buildStructureQuery(collection, ctx);
      if (query) candidates.push({ collection, pluginSlug, query });
    }
    const readable = await Promise.all(candidates.map((c) => this.readable(c.collection, ctx.options.user)));
    const jobs = candidates.filter((_, index) => readable[index]);

    for (let i = 0; i < jobs.length; i += ResolutionCollectionScanService.STRUCTURE_CHUNK_SIZE) {
      const chunk = jobs.slice(i, i + ResolutionCollectionScanService.STRUCTURE_CHUNK_SIZE);
      const settled = await Promise.allSettled(
        chunk.map((j) => this.restController.find(j.collection, { query: j.query, user: ctx.options.user, [CollectionReadRedaction.FOR_RESOLUTION]: true } as any)),
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

  /**
   * Whether ANY row of the collection holds one of the looked-up values, in one indexed query on the raw
   * table. The REST `find` that follows only ever NARROWS that same equality (access rules, status,
   * archive, user scope are all AND-ed on), so a collection with no such row cannot match and is skipped
   * — without its per-candidate finds and the access checks each of them makes, several of which are a
   * round trip to the collection's plugin process. On a path nothing holds (a 404, a framework page)
   * that was every such collection, every candidate, every check. A failing pre-check asks as before.
   */
  private async anyRowHolds(collection: ICollection, finds: Array<{ query: any }>): Promise<boolean> {
    try {
      const table = QueryHelper.getVirtualTable(collection);
      const clauses = finds.flatMap((f) => (['customPermalink', 'slug'] as const)
        .filter((field) => f.query[field] !== undefined && table[field])
        .map((field) => this.db.eq(table[field], f.query[field])));
      if (clauses.length !== finds.length) return true;
      const pk = collection.primaryKey || 'id';
      const rows = await this.db.find(table, { where: this.db.or(...clauses), limit: 1, ...(table[pk] ? { columns: { [pk]: true } } : {}) });
      return Array.isArray(rows) ? rows.length > 0 : true;
    } catch {
      return true;
    }
  }

  /**
   * Whether `user` may read `collection` at all — the same check the collection's `find` makes first. Only
   * a REFUSAL skips it; anything else going wrong here is left to the `find`, exactly as before.
   */
  private async readable(collection: ICollection, user: unknown): Promise<boolean> {
    try {
      await this.accessPolicy.resolveReadConstraints(collection, { query: {}, user });
      return true;
    } catch (error) {
      return !CollectionAccessPolicyService.isRefusal(error);
    }
  }

  async isPermalinkDisabled(collection: ICollection, docId: any, preview: boolean): Promise<boolean> {
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

  private buildStructureQuery(collection: ICollection, ctx: IResolutionStructureScanContext): any | null {
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
    const query: any = ctx.withLocale({ limit: 1 });
    if (searchId) query.id = searchId;
    if (searchSlug) query.slug = searchSlug;
    return query;
  }
}
