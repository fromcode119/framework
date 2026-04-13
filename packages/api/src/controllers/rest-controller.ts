import express, { Request, Response } from 'express';
import { Collection, Logger, RecordVersions, HookManager, TypeUtils } from '@fromcode119/core';
import { CoercionUtils, HookEventUtils, CollectionHookPhase } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { ApiUrlUtils } from '../utils/url';
import { 
  IDatabaseManager, 
  users
} from '@fromcode119/database';
import { ActivityService } from '../services/activity-service';
import { VersioningService } from '../services/versioning-service';
import { SuggestionService } from '../services/suggestion-service';
import { LocalizationService } from '../services/localization-service';
import { DataProcessorService } from '../services/data-processor-service';
import { QueryHelper } from '../services/query-helper';
import { ApiConfig } from '../config/api-config';
import { CollectionFieldGuard } from './collection-field-guard';

export class RESTController {
  private logger = new Logger({ namespace: 'REST' });
  private activityService: ActivityService;
  private versioningService: VersioningService;
  private suggestionService: SuggestionService;
  private localization: LocalizationService;
  private processor: DataProcessorService;
  private fieldGuard: CollectionFieldGuard;

  constructor(
    private db: IDatabaseManager, 
    private auth?: AuthManager,
    private onSettingsUpdate?: (key: string, value: any) => void,
    private hooks?: HookManager
  ) {
    this.activityService = new ActivityService(db);
    this.versioningService = new VersioningService(db);
    this.suggestionService = new SuggestionService(db);
    this.localization = new LocalizationService(db);
    this.processor = new DataProcessorService(auth, this.localization);
    this.fieldGuard = new CollectionFieldGuard(this.db, auth);
  }

  private async callCollectionHook<T>(collection: Collection, phase: CollectionHookPhase, payload: T): Promise<T> {
    if (!this.hooks) return payload;
    return await this.hooks.call(HookEventUtils.event(collection.slug, phase), payload) as T;
  }

  private resolveWriteTarget(collection: Collection): string {
    return collection.tableName || collection.slug;
  }

  private resolveRecordIdentifier(collection: Collection, item: any): any {
    const primaryKey = collection.primaryKey || 'id';
    return item?.[primaryKey];
  }

  private async insertCollectionRecord(collection: Collection, table: any, data: any): Promise<any> {
    const primaryKey = collection.primaryKey;
    if (!primaryKey || primaryKey === 'id' || data[primaryKey] === undefined) {
      return this.db.insert(this.resolveWriteTarget(collection), data);
    }

    return this.db.upsert(table, data, {
      target: primaryKey,
      set: Object.fromEntries(Object.entries(data).filter(([key]) => key !== primaryKey)),
    });
  }

  /** Universal find (handles both REST and Internal/GraphQL) */
  async find(collection: Collection, req: any, res?: Response) {
    try {
      const {
        limit,
        page,
        offset,
        sort,
        search,
        locale_mode,
        ...filters
      } = req.query || {};
      
      delete (filters as any).locale;
      delete (filters as any).fallback_locale;
      delete (filters as any).locale_mode;

      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.localization.getLocaleContext(req);
      const rawLocalized = String(locale_mode || '').toLowerCase() === 'raw';
      
      const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
      const isPreview = CoercionUtils.toBoolean(req.query?.preview) || CoercionUtils.toBoolean(req.query?.draft);

      // Status visibility logic
      if (!filters.status && !isAdmin && !isPreview) {
        if (collection.fields.find(f => f.name === 'status')) {
            filters.status = 'published';
        }
      }

      const whereClause = QueryHelper.buildWhereClause(this.db, collection, table, filters, search);
      const orderBy = QueryHelper.buildOrderBy(this.db, collection, table, sort);
      const defaultLimit = collection.slug === 'settings' ? 1000 : 10;
      
      const parsedLimit = parseInt(String(limit), 10);
      const limitVal = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 1000) : defaultLimit;

      const hasOffsetInput =
        offset !== undefined &&
        offset !== null &&
        String(offset).trim() !== '';
      const parsedOffset = parseInt(String(offset), 10);
      const parsedPage = parseInt(String(page), 10);
      const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const offsetVal = hasOffsetInput && Number.isFinite(parsedOffset) && parsedOffset >= 0
        ? parsedOffset
        : (safePage - 1) * limitVal;

      let rowsResult = await this.db.find(table, {
        where: whereClause,
        limit: limitVal,
        offset: offsetVal,
        orderBy: orderBy
      });

      // Special case: Populate user emails for Version History
      if (collection.slug === '_system_record_versions' && rowsResult.length > 0) {
        const userIds = [...new Set(rowsResult.map(r => r.updated_by).filter(Boolean))];
        if (userIds.length > 0) {
          const userData = await this.db.find(users, { where: this.db.inArray(users.id, userIds) });
          const userMap = new Map(userData.map(u => [u.id, u.email || u.username]));
          rowsResult = rowsResult.map(r => ({ ...r, updated_by: userMap.get(r.updated_by) || r.updated_by }));
        }
      }

      const total = await this.db.count(collection.tableName || collection.slug, { where: whereClause });

      const result = {
        docs: this.processor.filterHiddenFields(collection, rowsResult, { localeContext, rawLocalized }),
        totalDocs: total,
        limit: limitVal,
        offset: offsetVal,
        totalPages: Math.ceil(total / limitVal),
        page: Math.floor(offsetVal / limitVal) + 1
      };

      if (!res) return result;
      res.json(result);
    } catch (err: any) {
      this.logger.error(`Failed to find ${collection.slug} records: ${err.message}`, { stack: err.stack });
      if (!res) throw err;
      res.status(500).json({ error: err.message });
    }
  }

  async findOne(collection: Collection, req: any, res?: Response) {
    try {
      const { id } = req.params;
      const pk = collection.primaryKey || 'id';
      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.localization.getLocaleContext(req);
      const rawLocalized = String(req.query?.locale_mode || '').toLowerCase() === 'raw';
      
      const result = await this.db.findOne(table, { [pk]: pk === 'id' ? parseInt(id) : id });
      
      if (!result) {
        if (!res) return null;
        return res.status(404).json({ error: 'Not found' });
      }

      // Handle Status/Visibility
      const statusField = collection.fields.find(f => f.name === 'status');
      if (statusField && result.status !== 'published') {
        const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
        const isPreview = CoercionUtils.toBoolean(req.query?.preview) || CoercionUtils.toBoolean(req.query?.draft);
        if (!isAdmin && !isPreview) {
          if (!res) return null;
          return res.status(404).json({ error: 'Not found (draft)' });
        }
      }
      
      const filtered = this.processor.filterHiddenFields(collection, result, { localeContext, rawLocalized });
      if (!res) return filtered;
      res.json(filtered);
    } catch (err: any) {
      this.logger.error(`Failed to findOne ${collection.slug} record ${req.params.id}: ${err.message}`, { stack: err.stack });
      if (!res) throw err;
      res.status(500).json({ error: err.message });
    }
  }

  async create(collection: Collection, req: any, res?: Response) {
    try {
      const { data: sanitizedBody, overrideMeta } = this.fieldGuard.extractReadOnlyOverrideMetadata(req.body);
      let data = sanitizedBody;
      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.localization.getLocaleContext(req);

      await this.fieldGuard.enforceReadOnlyFieldConstraints({
        collection,
        incomingData: data,
        existingRecord: null,
        req,
        overrideMeta
      });
      
      // Hooks: Before Create
      data = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_CREATE, data);
      data = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_SAVE, data);

      // Restore REST-specific validation if in REST mode
      if (res) {
        const errors = collection.fields.filter(f => f.required && !data[f.name]).map(f => `Field "${f.name}" is required`);
        if (errors.length > 0) return res.status(400).json({ errors });
      }

      this.fieldGuard.assertPermalinkNotReserved(collection, data);

      const insertData = await this.processor.processIncomingData(collection, data, table, {
        localeContext
      });
      const newItem = await this.insertCollectionRecord(collection, table, insertData);

      // Hooks: After Create
      let finalItem = newItem;
      finalItem = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_CREATE, newItem);
      finalItem = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_SAVE, finalItem);
      const recordId = this.resolveRecordIdentifier(collection, finalItem);

      if (collection.versions !== false) {
        await this.versioningService.createSnapshot(collection, recordId, finalItem, req.user, `Initial creation of ${collection.slug} record`);
      }

      this.logger.info(`Created record in ${collection.slug} : ${recordId}`);
      this.emitCollectionEvent(collection, 'created', finalItem);
      this.emitCollectionEvent(collection, 'saved', finalItem);
      
      const filtered = this.processor.filterHiddenFields(collection, finalItem, {
        localeContext,
        rawLocalized: false
      });
      if (!res) return filtered;
      res.status(201).json(filtered);
    } catch (err: any) {
      const causeMsg = err?.cause?.message;
      this.logger.error(`Failed to create ${collection.slug} record: ${err.message}${causeMsg ? ` | cause: ${causeMsg}` : ''}`, { stack: err.stack });
      if (!res) throw err;
      const pgCode = err.code || err?.cause?.code;
      const status = err?.statusCode || (pgCode === '23505' ? 409 : 500);
      const errorMsg = causeMsg ? `${err.message} | ${causeMsg}` : err.message;
      res.status(status).json({ error: errorMsg });
    }
  }

  async update(collection: Collection, req: any, res?: Response) {
    try {
      const { id } = req.params;
      const { data: sanitizedBody, overrideMeta } = this.fieldGuard.extractReadOnlyOverrideMetadata(req.body);
      let data = sanitizedBody;
      const changeSummary = data._change_summary || `Update ${collection.slug} record`;
      
      // Strip metadata
      if (data._change_summary) {
        delete data._change_summary;
      }

      const pk = collection.primaryKey || 'id';
      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.localization.getLocaleContext(req);
      
      const where = { [pk]: pk === 'id' ? parseInt(id) : id };
      const existing = await this.db.findOne(table, where);
      if (!existing) {
        if (!res) return null;
        return res.status(404).json({ error: 'Not found' });
      }

      await this.fieldGuard.enforceReadOnlyFieldConstraints({
        collection,
        incomingData: data,
        existingRecord: existing,
        req,
        overrideMeta
      });

      // Hooks: Before Update
      data = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_UPDATE, data);
      data = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_SAVE, data);

      if (res) {
        const errors = collection.fields.filter(f => data[f.name] !== undefined && f.required && !data[f.name]).map(f => `Field "${f.name}" cannot be empty`);
        if (errors.length > 0) return res.status(400).json({ errors });
      }

      this.fieldGuard.assertPermalinkNotReserved(collection, data);

      const updateData = await this.processor.processIncomingData(collection, data, table, {
        existingRecord: existing,
        localeContext
      });
      const updated = await this.db.update(this.resolveWriteTarget(collection), where, updateData);
      
      if (!updated) {
        if (!res) return null;
        return res.status(404).json({ error: 'Not found' });
      }

      // Hooks: After Update
      let finalItem = updated;
      finalItem = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_UPDATE, updated);
      finalItem = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_SAVE, finalItem);

      if (collection.versions !== false) {
        await this.versioningService.createSnapshot(collection, id, finalItem, req.user, changeSummary);
      }

      this.logger.info(`Updated record in ${collection.slug} : ${id}`);
      this.emitCollectionEvent(collection, 'updated', finalItem);
      this.emitCollectionEvent(collection, 'saved', finalItem);
      
      const filtered = this.processor.filterHiddenFields(collection, finalItem, {
        localeContext,
        rawLocalized: false
      });
      if (!res) return filtered;
      res.json(filtered);
    } catch (err: any) {
      const causeMsg = err?.cause?.message;
      this.logger.error(`Failed to update ${collection.slug} record ${req.params.id}: ${err.message}${causeMsg ? ` | cause: ${causeMsg}` : ''}`, { stack: err.stack });
      if (!res) throw err;
      const pgCode = err.code || err?.cause?.code;
      const status = err?.statusCode || (pgCode === '23505' ? 409 : 500);
      const errorMsg = causeMsg ? `${err.message} | ${causeMsg}` : err.message;
      res.status(status).json({ error: errorMsg });
    }
  }

  async delete(collection: Collection, req: any, res?: Response) {
    try {
      const { id } = req.params;
      const pk = collection.primaryKey || 'id';
      const table = QueryHelper.getVirtualTable(collection);
      const success = await this.db.delete(this.resolveWriteTarget(collection), { [pk]: pk === 'id' ? parseInt(id) : id });

      if (success) {
        this.logger.info(`Deleted record in ${collection.slug} : ${id}`);
        this.emitCollectionEvent(collection, 'deleted', { id: pk === 'id' ? parseInt(id) : id });
      }
      
      if (!res) return success;
      res.json(success ? { success: true, id } : { error: 'Not found' });
    } catch (err: any) {
      this.logger.error(`Failed to delete ${collection.slug} record ${req.params.id}: ${err.message}`, { stack: err.stack });
      if (!res) throw err;
      res.status(500).json({ error: err.message });
    }
  }

  async bulkCreate(collection: Collection, req: any, res?: Response) {
    try {
      const items = Array.isArray(req.body) ? req.body : [req.body];
      const table = QueryHelper.getVirtualTable(collection);
      const results: any[] = [];
      const globalSummary = req.body._change_summary || `Bulk creation of ${collection.slug}`;
      const localeContext = await this.localization.getLocaleContext(req);
      for (let data of items) {
        data = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_CREATE, data);
        data = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_SAVE, data);
        this.fieldGuard.assertPermalinkNotReserved(collection, data);
        const individualSummary = data._change_summary || globalSummary;
        if (data._change_summary) delete data._change_summary;
        const insertData = await this.processor.processIncomingData(collection, data, table, { localeContext });
        const newItem = await this.insertCollectionRecord(collection, table, insertData);
        let finalItem = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_CREATE, newItem);
        finalItem = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_SAVE, finalItem);
        await this.versioningService.createSnapshot(collection, this.resolveRecordIdentifier(collection, finalItem), finalItem, req.user, individualSummary);
        this.emitCollectionEvent(collection, 'created', finalItem);
        this.emitCollectionEvent(collection, 'saved', finalItem);
        results.push(this.processor.filterHiddenFields(collection, finalItem, { localeContext, rawLocalized: false }));
      }
      if (!res) return results;
      res.status(201).json(results);
    } catch (err: any) {
      if (!res) throw err;
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async bulkUpdate(collection: Collection, req: any, res?: Response) {
    try {
      const { ids, data } = req.body;
      const changeSummary = req.body._change_summary || `Bulk update of ${collection.slug}`;
      if (!Array.isArray(ids) || ids.length === 0) {
        if (!res) throw new Error('ids must be a non-empty array');
        return res.status(400).json({ error: 'ids must be a non-empty array' });
      }
      const table = QueryHelper.getVirtualTable(collection);
      const writeTarget = this.resolveWriteTarget(collection);
      const pk = collection.primaryKey || 'id';
      const localeContext = await this.localization.getLocaleContext(req);
      const { data: sanitizedUpdateData, overrideMeta } = this.fieldGuard.extractReadOnlyOverrideMetadata(data);
      let updateData = sanitizedUpdateData;
      if (updateData._change_summary) delete updateData._change_summary;
      updateData = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_UPDATE, updateData);
      updateData = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_SAVE, updateData);
      this.fieldGuard.assertPermalinkNotReserved(collection, updateData);
      const results: any[] = [];
      for (const id of ids) {
        const where = { [pk]: pk === 'id' ? parseInt(id) : id };
        const existing = await this.db.findOne(table, where);
        if (!existing) continue;
        await this.fieldGuard.enforceReadOnlyFieldConstraints({ collection, incomingData: updateData, existingRecord: existing, req, overrideMeta });
        const processedUpdate = await this.processor.processIncomingData(collection, updateData, table, { existingRecord: existing, localeContext });
        const updated = await this.db.update(writeTarget, where, processedUpdate);
        if (updated) {
          let finalItem = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_UPDATE, updated);
          finalItem = await this.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_SAVE, finalItem);
          await this.versioningService.createSnapshot(collection, id, finalItem, req.user, changeSummary);
          this.emitCollectionEvent(collection, 'updated', finalItem);
          this.emitCollectionEvent(collection, 'saved', finalItem);
          results.push(this.processor.filterHiddenFields(collection, finalItem, { localeContext, rawLocalized: false }));
        }
      }
      if (!res) return results;
      res.json(results);
    } catch (err: any) {
      if (!res) throw err;
      res.status(500).json({ error: err.message });
    }
  }

  async bulkDelete(collection: Collection, req: any, res?: Response) {
    try {
      const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
      if (ids.length === 0) {
        if (!res) throw new Error('ids must be a non-empty array');
        return res.status(400).json({ error: 'ids must be a non-empty array' });
      }

      const table = QueryHelper.getVirtualTable(collection);
      const pk = collection.primaryKey || 'id';
      
      const success = await this.db.delete(table, this.db.inArray(table[pk], ids.map((id: any) => pk === 'id' ? parseInt(id) : id)));

      if (success) {
        this.emitCollectionEvent(collection, 'deleted', {
          ids: ids.map((id: any) => pk === 'id' ? parseInt(id) : id),
          count: ids.length
        });
      }
      
      if (!res) return success;
      res.json({ success, count: ids.length });
    } catch (err: any) {
      if (!res) throw err;
      res.status(500).json({ error: err.message });
    }
  }

  async getGlobalActivity(collections: any[], req: Request, res: Response) {
    try { res.json(await this.activityService.getGlobalActivity(collections)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  }

  async getSuggestions(collection: Collection, req: Request, res: Response) {
    try { const { field } = req.params; const { q } = req.query as any; res.json(await this.suggestionService.getSuggestions(collection, field, q)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  }

  async export(collection: Collection, req: Request, res: Response) {
    try {
      const { format = 'json' } = req.query;
      const table = QueryHelper.getVirtualTable(collection);
      const docs = await this.db.find(table, { limit: 10000 });
      if (format === 'csv') {
        const fields = collection.fields.map(f => f.name);
        const csvRows = [fields.join(','), ...docs.map((doc: any) => fields.map(f => { const v = doc[f]; const s = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); return `"${s.replace(/"/g, '""')}"`; }).join(','))];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${collection.slug}_export.csv`);
        return res.send(csvRows.join('\n'));
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${collection.slug}_export.json`);
      res.json(docs);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  }

  async import(collection: Collection, req: Request, res: Response) {
    try {
      const items = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ error: 'Payload must be an array of records' });
      const table = QueryHelper.getVirtualTable(collection);
      const results: any[] = [];
      const localeContext = await this.localization.getLocaleContext(req as any);
      for (const item of items) {
        const pk = collection.primaryKey || 'id';
        const itemData = { ...item }; delete itemData[pk];
        this.fieldGuard.assertPermalinkNotReserved(collection, itemData);
        try {
          const insertData = await this.processor.processIncomingData(collection, itemData, table, { localeContext });
          const newItem = await this.insertCollectionRecord(collection, table, insertData);
          results.push({ id: this.resolveRecordIdentifier(collection, newItem), status: 'success' });
        } catch (e: any) { results.push({ item: item.name || item.title || 'unknown', status: 'error', error: e.message }); }
      }
      res.json({ total: items.length, success: results.filter(r => r.status === 'success').length, errors: results.filter(r => r.status === 'error') });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  }

  // Versioning endpoints
  async getVersions(collection: Collection, req: any, res: Response) {
    try { const { id } = req.params; const { limit, offset } = req.query; res.json(await this.versioningService.getVersions(collection.slug, id, { limit: limit ? parseInt(limit as string) : 10, offset: offset ? parseInt(offset as string) : 0 })); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  }

  async getVersion(collection: Collection, req: any, res: Response) {
    try { const { id, version } = req.params; const result = await this.versioningService.getVersion(collection.slug, id, parseInt(version)); if (!result) return res.status(404).json({ error: 'Version not found' }); res.json(result); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  }

  async restoreVersion(collection: Collection, req: any, res: Response) {
    try { const { id, version } = req.params; const restoredData = await this.versioningService.restoreVersion(collection, id, parseInt(version), req.user); res.json({ message: `Successfully restored to version ${version}`, data: restoredData }); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  }

  private emitCollectionEvent(collection: Collection, action: string, payload: any): void {
    if (this.hooks) this.hooks.emit(`collection:${collection.slug}:${action}`, payload);
    if (this.onSettingsUpdate && collection.slug === 'settings' && action === 'saved' && payload?.key) {
      this.onSettingsUpdate(String(payload.key), payload.value);
    }
  }
}