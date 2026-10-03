import { Request, Response } from 'express';
import { ICollection } from '@fromcode119/core';
import { Schema } from '@fromcode119/database';
import { QueryHelper } from '@api/services/query-helper';
import { SystemMetaCollectionGuard } from '@api/services/system-meta-collection-guard';
import { UserCollectionScopeGuard } from '@api/services/user-collection-scope-guard';
import { CollectionArchiveReadClause } from '@api/services/collection-archive-read-clause';
import { CollectionReadRedaction } from '@api/services/collection-read-redaction';
import { RestControllerRuntime } from '@api/controllers/rest/rest-controller-runtime';
import { CoercionUtils, CollectionArchive } from '@fromcode119/core';

export class RestReadController {
  constructor(private readonly runtime: RestControllerRuntime) {}

  async find(collection: ICollection, req: any, res?: Response) {
    try {
      const { limit, page, offset, sort, search, locale_mode, ...filters } = req.query || {};
      delete (filters as any).locale;
      delete (filters as any).fallback_locale;
      delete (filters as any).locale_mode;
      const archivedParam = CoercionUtils.toKey((filters as any)[CollectionArchive.QUERY_PARAM]);
      delete (filters as any)[CollectionArchive.QUERY_PARAM];

      const accessConstraints = await this.runtime.accessPolicy.resolveReadConstraints(collection, req);
      const effectiveFilters: Record<string, unknown> = { ...filters, ...accessConstraints };
      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.runtime.localization.getLocaleContext(req);
      const rawLocalized = String(locale_mode || '').toLowerCase() === 'raw';
      // Unpublished records are visible to an AUTHORIZED session only. `?preview=1`/`?draft=1` used to
      // lift this default filter on its own, which handed every draft to any anonymous caller.
      const canPreview = await this.runtime.accessPolicy.seesUnpublished(collection, req);

      // Not a default the caller may override: `?status=draft` used to replace it and list every draft.
      if (!canPreview && collection.fields.find((field) => field.name === 'status')) {
        effectiveFilters.status = 'published';
      }
      const partialReader = !(await this.runtime.accessPolicy.readsEverything(collection, req));
      if (partialReader) CollectionReadRedaction.assertQueryable(collection, filters, sort);

      const relationshipMatches = await this.resolveRelationshipSearchMatches(req, search);
      const userScope = await UserCollectionScopeGuard.scopeFor(collection, req, this.runtime.db);
      // Only a session that may see unpublished records may ask for the archived ones.
      const archivedOnly = archivedParam === CollectionArchive.QUERY_ONLY && canPreview;
      const whereClause = QueryHelper.buildWhereClause(
        this.runtime.db, collection, table, effectiveFilters, search, relationshipMatches,
        CollectionArchiveReadClause.combine(this.runtime.db, UserCollectionScopeGuard.buildReadClause(userScope),
          CollectionArchiveReadClause.build(this.runtime.db, collection, table, archivedOnly)),
        partialReader,
      );
      const orderBy = QueryHelper.buildOrderBy(this.runtime.db, collection, table, sort);
      const defaultLimit = collection.slug === 'settings' ? 1000 : 10;
      const parsedLimit = parseInt(String(limit), 10);
      const limitValue = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 1000) : defaultLimit;
      const hasOffsetInput = offset !== undefined && offset !== null && String(offset).trim() !== '';
      const parsedOffset = parseInt(String(offset), 10);
      const parsedPage = parseInt(String(page), 10);
      const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const offsetValue = hasOffsetInput && Number.isFinite(parsedOffset) && parsedOffset >= 0
        ? parsedOffset
        : (safePage - 1) * limitValue;

      let rowsResult = await this.runtime.db.find(table, {
        where: whereClause,
        limit: limitValue,
        offset: offsetValue,
        orderBy,
      });

      if (collection.slug === '_system_record_versions' && rowsResult.length > 0) {
        // Snapshots written before password fields were excluded still hold them; serve none.
        rowsResult = rowsResult.map((row) => this.runtime.versioningService.redactStoredVersion(row));
        const userIds = [...new Set(rowsResult.map((row) => row.updated_by).filter(Boolean))];
        if (userIds.length > 0) {
          const userData = await this.runtime.db.find(Schema.users, {
            where: this.runtime.db.inArray(Schema.users.id, userIds),
          });
          const userMap = new Map(userData.map((user) => [user.id, user.email || user.username]));
          rowsResult = rowsResult.map((row) => ({
            ...row,
            updated_by: userMap.get(row.updated_by) || row.updated_by,
          }));
        }
      }

      const total = await this.runtime.db.count(table, { where: whereClause });
      const result = {
        docs: this.forReader(collection, req, partialReader,
          this.runtime.processor.filterHiddenFields(collection, rowsResult, { localeContext, rawLocalized })),
        totalDocs: total,
        limit: limitValue,
        offset: offsetValue,
        totalPages: Math.ceil(total / limitValue),
        page: Math.floor(offsetValue / limitValue) + 1,
      };

      if (!res) {
        return result;
      }
      res.json(result);
    } catch (err: any) {
      this.logFailure(err, `Failed to find ${collection.slug} records: ${err.message}`);
      if (!res) {
        throw err;
      }
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  /**
   * Resolve list-search matches that live on RELATED records. For each relationship field on the
   * collection (descriptors attached by CollectionMiddleware), query the related table for rows whose
   * searchable text columns match the term, and return { fieldName: [relatedIds] }. The where-builder
   * then ORs `field IN (ids)` alongside the scalar search, so e.g. searching the inventory list by a
   * product name matches the inventory rows that point at those products.
   */
  private async resolveRelationshipSearchMatches(req: any, search?: string): Promise<Record<string, any[]>> {
    const term = String(search || '').trim();
    const targets = Array.isArray(req?.relationshipSearchTargets) ? req.relationshipSearchTargets : [];
    if (!term || targets.length === 0) return {};

    const matches: Record<string, any[]> = {};
    for (const target of targets) {
      try {
        const rows = await this.runtime.db.find(target.tableName, {
          // Raw term (not lower-cased): SQLite LIKE only folds ASCII case, so lowering would break
          // same-case Cyrillic matching. ASCII still matches case-insensitively via LIKE.
          search: { columns: target.columns, value: term },
          columns: { [target.primaryKey]: true },
          limit: 1000,
        });
        const ids = rows
          .map((row: any) => row?.[target.primaryKey])
          .filter((value: any) => value !== undefined && value !== null);
        if (ids.length) matches[target.field] = ids;
      } catch (err: any) {
        this.runtime.logger.warn(`Relationship search for "${target.field}" failed: ${err?.message}`);
      }
    }
    return matches;
  }

  async findOne(collection: ICollection, req: any, res?: Response) {
    try {
      const accessConstraints = await this.runtime.accessPolicy.resolveReadConstraints(collection, req);
      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.runtime.localization.getLocaleContext(req);
      const rawLocalized = CoercionUtils.toKey(req.query?.locale_mode) === 'raw';
      const id = this.runtime.parseRecordIdentifier(collection, req.params.id);
      const primaryKey = collection.primaryKey || 'id';
      const userScope = await UserCollectionScopeGuard.scopeFor(collection, req, this.runtime.db);
      const result = UserCollectionScopeGuard.allows(userScope, id)
        ? await this.runtime.db.findOne(table, { [primaryKey]: id })
        : null;

      if (!result) {
        if (!res) {
          return null;
        }
        return res.status(404).json({ error: 'Not found' });
      }

      // A single-record read bypasses the list WHERE clause, so the system-meta restriction is
      // re-applied here — otherwise `/collections/settings/auth:password_reset_token:<x>` hands back
      // the one row by name.
      if (!SystemMetaCollectionGuard.allowsRecord(collection, result as Record<string, unknown>)) {
        if (!res) {
          return null;
        }
        return res.status(404).json({ error: 'Not found' });
      }

      if (!this.runtime.accessPolicy.matchesReadConstraints(result as Record<string, unknown>, accessConstraints)) {
        if (!res) {
          return null;
        }
        return res.status(404).json({ error: 'Not found' });
      }

      // An archived record is gone for the public, like a draft; the admin still opens it to restore it.
      const archived = CollectionArchive.isArchivable(collection)
        && CollectionArchive.isArchived(result as Record<string, unknown>);
      if (archived && !(await this.runtime.accessPolicy.seesUnpublished(collection, req))) {
        if (!res) {
          return null;
        }
        return res.status(404).json({ error: 'Not found' });
      }

      const statusField = collection.fields.find((field) => field.name === 'status');
      if (statusField && result.status !== 'published') {
        // Same gate as the list read above — a query parameter cannot make a draft readable.
        if (!(await this.runtime.accessPolicy.seesUnpublished(collection, req))) {
          if (!res) {
            return null;
          }
          return res.status(404).json({ error: 'Not found (draft)' });
        }
      }

      const filtered = this.forReader(collection, req, !(await this.runtime.accessPolicy.readsEverything(collection, req)),
        this.runtime.processor.filterHiddenFields(collection, result, { localeContext, rawLocalized }));
      if (!res) {
        return filtered;
      }
      res.json(filtered);
    } catch (err: any) {
      this.logFailure(err, `Failed to findOne ${collection.slug} record ${req.params.id}: ${err.message}`);
      if (!res) {
        throw err;
      }
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async getGlobalActivity(collections: any[], req: Request, res: Response) {
    try {
      res.json(await this.runtime.activityService.getGlobalActivity(collections));
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  /**
   * The records as this reader may see them. Page resolution reads on the visitor's behalf and leaves
   * what is held back conditionally to the plugins' content gates, which know the visitor; it strips
   * the staff-only fields itself once they have run.
   */
  private forReader<T>(collection: ICollection, req: any, partialReader: boolean, data: T): T {
    if (!partialReader || req?.[CollectionReadRedaction.FOR_RESOLUTION] === true) return data;
    return CollectionReadRedaction.redact(collection, data);
  }

  /**
   * An access refusal (401/403) is the policy doing its job, not a server failure. Page resolution asks
   * every collection for a slug on each anonymous visit, and a collection a visitor may not read
   * (broadcast lists, campaigns) answered with an [ERROR] and a stack trace per request — noise that
   * buries real failures. Refusals are logged at debug; everything else stays an error.
   */
  private logFailure(err: any, message: string): void {
    const status = Number(err?.statusCode);
    if (status === 401 || status === 403) {
      this.runtime.logger.debug(message);
      return;
    }
    this.runtime.logger.error(message, { stack: err?.stack });
  }
}
