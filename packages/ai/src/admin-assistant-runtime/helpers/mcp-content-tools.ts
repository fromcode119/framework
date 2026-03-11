import type { McpToolDefinition } from '@fromcode119/mcp';
import type { AdminAssistantRuntimeOptions } from '../types';
import { SearchTextHelpers } from './search-text-helpers';
import { PathObjectHelpers } from './path-object-helpers';
import { RuntimeMiscHelpers } from './runtime-misc-helpers';

/** MCP tool definitions for content and collection operations. */
export class McpContentTools {
  static build(options: AdminAssistantRuntimeOptions, _dryRun: boolean): McpToolDefinition[] {
    return [
      {
        tool: 'collections.list', readOnly: true,
        description: 'List available content collections.',
        handler: async () => ({
          collections: options.getCollections().map((c) => ({ slug: c.slug, shortSlug: c.shortSlug, label: c.label, pluginSlug: c.pluginSlug })),
        }),
      },
      {
        tool: 'collections.resolve', readOnly: true,
        description: 'Resolve a collection by slug, short slug, or unprefixed slug.',
        handler: async (input) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const collection = options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
          return { slug: collection.slug, shortSlug: collection.shortSlug, label: collection.label, pluginSlug: collection.pluginSlug };
        },
      },
      {
        tool: 'content.list', readOnly: true,
        description: 'List content items from a collection.',
        handler: async (input, context) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const collection = options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
          if (typeof options.listContent !== 'function') throw new Error('content.list is not available in this runtime.');
          const limit = Math.min(100, Math.max(1, Number(input?.limit || 20)));
          const offset = Math.max(0, Number(input?.offset || 0));
          const result = await options.listContent(collection, { limit, offset, context: context || {} });
          return { collectionSlug: collection.slug, docs: Array.isArray(result?.docs) ? result.docs : [], totalDocs: Number(result?.totalDocs || 0), limit, offset };
        },
      },
      {
        tool: 'content.search_text', readOnly: true,
        description: 'Search text across content collections, including localized map fields.',
        handler: async (input, context) => {
          if (typeof options.listContent !== 'function') throw new Error('content.search_text is not available in this runtime.');
          const query = String(input?.query || input?.text || '').trim();
          if (!query) throw new Error('Missing search query');
          const queryLower = SearchTextHelpers.normalizeSearchText(query);
          const queryTokens = SearchTextHelpers.tokenizeSearchQuery(query);
          const requestedCollectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const maxDocs = Math.min(200, Math.max(1, Number(input?.limit || 80)));
          const maxMatches = Math.min(200, Math.max(1, Number(input?.maxMatches || 40)));
          const requestedFields = Array.isArray(input?.fields) ? input.fields.map((f: any) => String(f || '').trim()).filter(Boolean) : [];
          const scopedCollection = requestedCollectionSlug ? options.findCollectionBySlug(requestedCollectionSlug) : null;
          if (requestedCollectionSlug && !scopedCollection) throw new Error(`Unknown collection: ${requestedCollectionSlug}`);
          const targetCollections = scopedCollection ? [scopedCollection] : options.getCollections();
          const matches: Array<{ collectionSlug: string; recordId: string | number | null; field: string; value: string }> = [];
          for (const collection of targetCollections) {
            if (matches.length >= maxMatches) break;
            const listResult = await options.listContent!(collection, { limit: maxDocs, offset: 0, context: context || {} });
            const docs = Array.isArray(listResult?.docs) ? listResult.docs : [];
            const primaryKey = String(collection.raw?.primaryKey || 'id');
            for (const doc of docs) {
              if (matches.length >= maxMatches) break;
              if (!doc || typeof doc !== 'object') continue;
              if (RuntimeMiscHelpers.isInternalAssistantSessionRecord(collection.slug, doc)) continue;
              const recordId = (doc as any)?.[primaryKey] ?? (doc as any)?.id ?? null;
              const fieldEntries: Array<{ fieldPath: string; fieldValue: any }> = requestedFields.length
                ? requestedFields.map((f: string) => ({ fieldPath: f, fieldValue: PathObjectHelpers.readPathValue(doc, f) }))
                : Object.entries(doc).filter(([rawField]) => { const f = String(rawField || '').trim(); return f && !f.startsWith('_'); }).map(([rawField, rawValue]) => ({ fieldPath: String(rawField || '').trim(), fieldValue: rawValue }));
              for (const fieldEntry of fieldEntries) {
                if (matches.length >= maxMatches) break;
                const found = SearchTextHelpers.collectStringMatches(fieldEntry.fieldValue, queryLower, queryTokens, fieldEntry.fieldPath, 0, 5);
                for (const item of found) {
                  if (matches.length >= maxMatches) break;
                  matches.push({ collectionSlug: collection.slug, recordId, field: item.path, value: item.value.length > 240 ? `${item.value.slice(0, 240)}...` : item.value });
                }
              }
            }
          }
          return { query, matches, totalMatches: matches.length, truncated: matches.length >= maxMatches };
        },
      },
      {
        tool: 'content.create', readOnly: false,
        description: 'Create a content item in a collection.',
        handler: async (input, context) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const payload = input?.data && typeof input.data === 'object' ? input.data : {};
          const collection = options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
          const effectiveDryRun = context?.dryRun === true || _dryRun;
          if (effectiveDryRun) {
            return { dryRun: true, action: { type: 'create_content', collectionSlug: collection.slug, data: payload }, preview: payload,
              visualPreview: { path: RuntimeMiscHelpers.resolveRecordPreviewPath(payload, collection.slug), title: RuntimeMiscHelpers.resolveRecordPreviewTitle(payload) } };
          }
          const created = await options.createContent(collection, payload, context || {});
          return { dryRun: false, action: { type: 'create_content', collectionSlug: collection.slug, data: payload }, id: created?.id, item: created,
            visualPreview: { path: RuntimeMiscHelpers.resolveRecordPreviewPath(created, collection.slug), title: RuntimeMiscHelpers.resolveRecordPreviewTitle(created) } };
        },
      },
      {
        tool: 'content.resolve', readOnly: true,
        description: 'Resolve a single content item by id, slug, permalink, or where filters.',
        handler: async (input, context) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const collection = options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
          if (typeof options.resolveContent !== 'function') throw new Error('content.resolve is not available in this runtime.');
          const selector = {
            id: input?.id ?? input?.recordId,
            slug: input?.entrySlug ? String(input.entrySlug) : input?.lookupSlug ? String(input.lookupSlug) : input?.slugValue ? String(input.slugValue) : input?.slug ? String(input.slug) : undefined,
            permalink: input?.permalink ? String(input.permalink) : input?.path ? String(input.path) : undefined,
            where: input?.where && typeof input.where === 'object' ? input.where : undefined,
          };
          const item = await options.resolveContent(collection, selector, context || {});
          return { collectionSlug: collection.slug, found: !!item, item: item || null };
        },
      },
      {
        tool: 'content.update', readOnly: false,
        description: 'Update one content item by id/slug/permalink and return before/after preview.',
        handler: async (input, context) => {
          const collectionSlug = String(input?.collectionSlug || input?.slug || '').trim();
          const payload = input?.data && typeof input.data === 'object' ? input.data : {};
          const collection = options.findCollectionBySlug(collectionSlug);
          if (!collection) throw new Error(`Unknown collection: ${collectionSlug}`);
          if (typeof options.resolveContent !== 'function' || typeof options.updateContent !== 'function') throw new Error('content.update is not available in this runtime.');
          const selector = {
            id: input?.id ?? input?.recordId,
            slug: input?.entrySlug ? String(input.entrySlug) : input?.lookupSlug ? String(input.lookupSlug) : input?.slugValue ? String(input.slugValue) : undefined,
            permalink: input?.permalink ? String(input.permalink) : input?.path ? String(input.path) : undefined,
            where: input?.where && typeof input.where === 'object' ? input.where : undefined,
          };
          const effectiveDryRun = context?.dryRun === true || _dryRun;
          if (!payload || Object.keys(payload).length === 0) {
            return { dryRun: effectiveDryRun, skipped: true, reason: 'No values to set', action: { type: 'mcp_call', tool: 'content.update', input: { collectionSlug: collection.slug, ...selector, data: payload } } };
          }
          const existing = await options.resolveContent(collection, selector, context || {});
          if (!existing || typeof existing !== 'object') throw new Error(`Record not found in "${collection.slug}" for the provided selector.`);
          const primaryKey = String(collection.raw?.primaryKey || 'id');
          const targetId = (existing as any)?.[primaryKey] ?? selector.id;
          if (targetId === undefined || targetId === null || String(targetId).trim() === '') throw new Error(`Resolved record in "${collection.slug}" does not expose primary key "${primaryKey}".`);
          const changedFields = RuntimeMiscHelpers.diffChangedFields(existing, payload);
          const before = RuntimeMiscHelpers.pickRecordFields(existing, changedFields.map((e) => e.field));
          const beforePreviewPath = RuntimeMiscHelpers.resolveRecordPreviewPath(existing, collection.slug);
          const afterDraftRecord = { ...(existing || {}), ...(payload || {}) };
          const afterDraftPreviewPath = RuntimeMiscHelpers.resolveRecordPreviewPath(afterDraftRecord, collection.slug);
          if (changedFields.length === 0) {
            return { dryRun: effectiveDryRun, skipped: true, reason: 'No values to set', action: { type: 'mcp_call', tool: 'content.update', input: { collectionSlug: collection.slug, id: targetId, data: payload } },
              target: { collectionSlug: collection.slug, primaryKey, id: targetId }, changedFields: [], before: {}, after: {},
              visualPreview: { beforePath: beforePreviewPath, afterPath: beforePreviewPath, beforeTitle: RuntimeMiscHelpers.resolveRecordPreviewTitle(existing), afterTitle: RuntimeMiscHelpers.resolveRecordPreviewTitle(existing) } };
          }
          if (effectiveDryRun) {
            const after = RuntimeMiscHelpers.pickRecordFields(afterDraftRecord, changedFields.map((e) => e.field));
            return { dryRun: true, action: { type: 'mcp_call', tool: 'content.update', input: { collectionSlug: collection.slug, id: targetId, data: payload } },
              target: { collectionSlug: collection.slug, primaryKey, id: targetId }, changedFields, before, after,
              visualPreview: { beforePath: beforePreviewPath, afterPath: afterDraftPreviewPath, beforeTitle: RuntimeMiscHelpers.resolveRecordPreviewTitle(existing), afterTitle: RuntimeMiscHelpers.resolveRecordPreviewTitle(afterDraftRecord) } };
          }
          const updated = await options.updateContent!(collection, targetId, payload, context || {});
          const after = RuntimeMiscHelpers.pickRecordFields(updated, changedFields.map((e) => e.field));
          return { dryRun: false, action: { type: 'mcp_call', tool: 'content.update', input: { collectionSlug: collection.slug, id: targetId, data: payload } },
            target: { collectionSlug: collection.slug, primaryKey, id: targetId }, changedFields, before, after, item: updated,
            visualPreview: { beforePath: beforePreviewPath, afterPath: RuntimeMiscHelpers.resolveRecordPreviewPath(updated, collection.slug), beforeTitle: RuntimeMiscHelpers.resolveRecordPreviewTitle(existing), afterTitle: RuntimeMiscHelpers.resolveRecordPreviewTitle(updated) } };
        },
      },
    ];
  }
}
