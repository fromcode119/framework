import express, { Request, Response } from 'express';
import { Collection, Logger, RecordVersions, HookManager, parseBoolean } from '@fromcode/core';
import { AuthManager } from '@fromcode/auth';
import { 
  IDatabaseManager, 
  sql, 
  and, 
  or,
  eq, 
  ilike,
  desc,
  asc,
  createDynamicTable,
  users,
  inArray,
  timestamp
} from '@fromcode/database';
import { ActivityService } from '../services/activity-service';
import { VersioningService } from '../services/versioning-service';
import { SuggestionService } from '../services/suggestion-service';
import { LocalizationService } from '../services/localization-service';
import { DataProcessorService } from '../services/data-processor-service';
import { QueryHelper } from '../services/query-helper';
import { RESERVED_PERMALINK_CONFIG } from '../constants';

export class RESTController {
  private logger = new Logger({ namespace: 'REST' });
  private activityService: ActivityService;
  private versioningService: VersioningService;
  private suggestionService: SuggestionService;
  private localization: LocalizationService;
  private processor: DataProcessorService;

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
  }

  /**
   * Universal find (handles both REST and Internal/GraphQL)
   */
  async find(collection: Collection, req: any, res?: Response) {
    try {
      const {
        limit = 10,
        offset = 0,
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
      const isPreview = parseBoolean(req.query?.preview) || parseBoolean(req.query?.draft);

      // Status visibility logic
      if (!filters.status && !isAdmin && !isPreview) {
        if (collection.fields.find(f => f.name === 'status')) {
            filters.status = 'published';
        }
      }

      const whereClause = QueryHelper.buildWhereClause(collection, table, filters, search);
      const orderBy = QueryHelper.buildOrderBy(collection, table, sort);
      
      const limitVal = Math.min(parseInt(limit as string) || 10, 100);
      const offsetVal = parseInt(offset as string) || 0;

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
          const userData = await this.db.find(users, { where: inArray(users.id, userIds) });
          const userMap = new Map(userData.map(u => [u.id, u.email || u.username]));
          rowsResult = rowsResult.map(r => ({ ...r, updated_by: userMap.get(r.updated_by) || r.updated_by }));
        }
      }

      const total = await this.db.count(collection.tableName || collection.slug, whereClause);

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
        const isPreview = parseBoolean(req.query?.preview) || parseBoolean(req.query?.draft);
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
      const { data: sanitizedBody, overrideMeta } = this.extractReadOnlyOverrideMetadata(req.body);
      let data = sanitizedBody;
      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.localization.getLocaleContext(req);

      await this.enforceReadOnlyFieldConstraints({
        collection,
        incomingData: data,
        existingRecord: null,
        req,
        overrideMeta
      });
      
      // Hooks: Before Create
      if (this.hooks) {
        data = await this.hooks.call(`collection:${collection.slug}:beforeCreate`, data);
        data = await this.hooks.call(`collection:${collection.slug}:beforeSave`, data);
      }

      // Restore REST-specific validation if in REST mode
      if (res) {
        const errors = collection.fields.filter(f => f.required && !data[f.name]).map(f => `Field "${f.name}" is required`);
        if (errors.length > 0) return res.status(400).json({ errors });
      }

      this.assertPermalinkNotReserved(collection, data);

      const insertData = await this.processor.processIncomingData(collection, data, table, {
        localeContext
      });
      const newItem = await this.db.insert(table, insertData);

      // Hooks: After Create
      let finalItem = newItem;
      if (this.hooks) {
        finalItem = await this.hooks.call(`collection:${collection.slug}:afterCreate`, newItem);
        finalItem = await this.hooks.call(`collection:${collection.slug}:afterSave`, finalItem);
      }

      if (collection.versions !== false) {
        await this.versioningService.createSnapshot(collection, finalItem.id, finalItem, req.user, `Initial creation of ${collection.slug} record`);
      }

      this.logger.info(`Created record in ${collection.slug} : ${finalItem.id}`);
      this.emitCollectionEvent(collection, 'created', finalItem);
      this.emitCollectionEvent(collection, 'saved', finalItem);
      
      const filtered = this.processor.filterHiddenFields(collection, finalItem, {
        localeContext,
        rawLocalized: false
      });
      if (!res) return filtered;
      res.status(201).json(filtered);
    } catch (err: any) {
      this.logger.error(`Failed to create ${collection.slug} record: ${err.message}`, { stack: err.stack });
      if (!res) throw err;
      const status = err?.statusCode || (err.code === '23505' ? 409 : 500);
      res.status(status).json({ error: err.message });
    }
  }

  async update(collection: Collection, req: any, res?: Response) {
    try {
      const { id } = req.params;
      const { data: sanitizedBody, overrideMeta } = this.extractReadOnlyOverrideMetadata(req.body);
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

      await this.enforceReadOnlyFieldConstraints({
        collection,
        incomingData: data,
        existingRecord: existing,
        req,
        overrideMeta
      });

      // Hooks: Before Update
      if (this.hooks) {
        data = await this.hooks.call(`collection:${collection.slug}:beforeUpdate`, data);
        data = await this.hooks.call(`collection:${collection.slug}:beforeSave`, data);
      }

      if (res) {
        const errors = collection.fields.filter(f => data[f.name] !== undefined && f.required && !data[f.name]).map(f => `Field "${f.name}" cannot be empty`);
        if (errors.length > 0) return res.status(400).json({ errors });
      }

      this.assertPermalinkNotReserved(collection, data);

      const updateData = await this.processor.processIncomingData(collection, data, table, {
        existingRecord: existing,
        localeContext
      });
      const updated = await this.db.update(table, where, updateData);
      
      if (!updated) {
        if (!res) return null;
        return res.status(404).json({ error: 'Not found' });
      }

      // Hooks: After Update
      let finalItem = updated;
      if (this.hooks) {
        finalItem = await this.hooks.call(`collection:${collection.slug}:afterUpdate`, updated);
        finalItem = await this.hooks.call(`collection:${collection.slug}:afterSave`, finalItem);
      }

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
      this.logger.error(`Failed to update ${collection.slug} record ${req.params.id}: ${err.message}`, { stack: err.stack });
      if (!res) throw err;
      const status = err?.statusCode || (err.code === '23505' ? 409 : 500);
      res.status(status).json({ error: err.message });
    }
  }

  async delete(collection: Collection, req: any, res?: Response) {
    try {
      const { id } = req.params;
      const pk = collection.primaryKey || 'id';
      const table = QueryHelper.getVirtualTable(collection);
      const success = await this.db.delete(table, { [pk]: pk === 'id' ? parseInt(id) : id });

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
        if (this.hooks) {
          data = await this.hooks.call(`collection:${collection.slug}:beforeCreate`, data);
          data = await this.hooks.call(`collection:${collection.slug}:beforeSave`, data);
        }

        this.assertPermalinkNotReserved(collection, data);
        
        const individualSummary = data._change_summary || globalSummary;
        if (data._change_summary) delete data._change_summary;

        const insertData = await this.processor.processIncomingData(collection, data, table, {
          localeContext
        });
        const newItem = await this.db.insert(table, insertData);
        
        let finalItem = newItem;
        if (this.hooks) {
          finalItem = await this.hooks.call(`collection:${collection.slug}:afterCreate`, newItem);
          finalItem = await this.hooks.call(`collection:${collection.slug}:afterSave`, finalItem);
        }
        await this.versioningService.createSnapshot(collection, finalItem.id, finalItem, req.user, individualSummary);
        this.emitCollectionEvent(collection, 'created', finalItem);
        this.emitCollectionEvent(collection, 'saved', finalItem);
        results.push(this.processor.filterHiddenFields(collection, finalItem, {
          localeContext,
          rawLocalized: false
        }));
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
      const pk = collection.primaryKey || 'id';
      const localeContext = await this.localization.getLocaleContext(req);
      
      const { data: sanitizedUpdateData, overrideMeta } = this.extractReadOnlyOverrideMetadata(data);
      let updateData = sanitizedUpdateData;
      if (updateData._change_summary) delete updateData._change_summary;

      if (this.hooks) {
        updateData = await this.hooks.call(`collection:${collection.slug}:beforeUpdate`, updateData);
        updateData = await this.hooks.call(`collection:${collection.slug}:beforeSave`, updateData);
      }

      this.assertPermalinkNotReserved(collection, updateData);

      // Update one by one to ensure hooks and versioning trigger correctly per item
      const results: any[] = [];
      for (const id of ids) {
        const where = { [pk]: pk === 'id' ? parseInt(id) : id };
        const existing = await this.db.findOne(table, where);
        if (!existing) continue;

        await this.enforceReadOnlyFieldConstraints({
          collection,
          incomingData: updateData,
          existingRecord: existing,
          req,
          overrideMeta
        });

        const processedUpdate = await this.processor.processIncomingData(collection, updateData, table, {
          existingRecord: existing,
          localeContext
        });
        const updated = await this.db.update(table, where, processedUpdate);
        if (updated) {
          let finalItem = updated;
          if (this.hooks) {
            finalItem = await this.hooks.call(`collection:${collection.slug}:afterUpdate`, updated);
            finalItem = await this.hooks.call(`collection:${collection.slug}:afterSave`, finalItem);
          }
          await this.versioningService.createSnapshot(collection, id, finalItem, req.user, changeSummary);
          this.emitCollectionEvent(collection, 'updated', finalItem);
          this.emitCollectionEvent(collection, 'saved', finalItem);
          results.push(this.processor.filterHiddenFields(collection, finalItem, {
            localeContext,
            rawLocalized: false
          }));
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
      
      const success = await this.db.delete(table, inArray(table[pk], ids.map((id: any) => pk === 'id' ? parseInt(id) : id)));

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

  async getGlobalActivity(collections: Collection[], req: Request, res: Response) {
    try {
      res.json(await this.activityService.getGlobalActivity(collections));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getSuggestions(collection: Collection, req: Request, res: Response) {
    try {
      const { field } = req.params;
      const { q } = req.query as any;
      res.json(await this.suggestionService.getSuggestions(collection, field, q, QueryHelper.getVirtualTable(collection)));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async export(collection: Collection, req: Request, res: Response) {
    try {
      const { format = 'json' } = req.query;
      const table = QueryHelper.getVirtualTable(collection);
      
      const docs = await this.db.find(table, {
        limit: 10000 
      });

      if (format === 'csv') {
        const fields = collection.fields.map(f => f.name);
        const csvRows = [fields.join(',')];
        
        docs.forEach(doc => {
          const row = fields.map(f => {
            const val = doc[f];
            if (val === null || val === undefined) return '';
            const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          });
          csvRows.push(row.join(','));
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${collection.slug}_export.csv`);
        return res.send(csvRows.join('\n'));
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${collection.slug}_export.json`);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async import(collection: Collection, req: Request, res: Response) {
    try {
      const items = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Payload must be an array of records' });
      }

      const table = QueryHelper.getVirtualTable(collection);
      const results: any[] = [];
      const localeContext = await this.localization.getLocaleContext(req as any);
      
      for (const item of items) {
        const pk = collection.primaryKey || 'id';
        const itemData = { ...item };
        delete itemData[pk]; 
        this.assertPermalinkNotReserved(collection, itemData);
        
        try {
          const insertData = await this.processor.processIncomingData(collection, itemData, table, {
            localeContext
          });
          const newItem = await this.db.insert(table, insertData);
          results.push({ id: newItem.id, status: 'success' });
        } catch (e: any) {
          results.push({ item: item.name || item.title || 'unknown', status: 'error', error: e.message });
        }
      }

      res.json({
        total: items.length,
        success: results.filter(r => r.status === 'success').length,
        errors: results.filter(r => r.status === 'error')
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  private extractReadOnlyOverrideMetadata(payload: any): {
    data: Record<string, any>;
    overrideMeta: { fields: Set<string>; password: string };
  } {
    const data = payload && typeof payload === 'object' ? { ...payload } : {};
    const rawOverride = data._readOnlyOverride && typeof data._readOnlyOverride === 'object'
      ? data._readOnlyOverride
      : null;
    delete data._readOnlyOverride;

    const fields = Array.isArray(rawOverride?.fields)
      ? rawOverride.fields.map((field: any) => String(field || '').trim()).filter(Boolean)
      : [];
    const password = String(rawOverride?.password || '');

    return {
      data,
      overrideMeta: {
        fields: new Set(fields),
        password
      }
    };
  }

  private isReadOnlyOverrideable(field: any): boolean {
    return Boolean(
      field?.admin?.readOnly &&
      (field?.admin?.readOnlyOverride === 'password' || field?.admin?.allowReadOnlyOverride === true)
    );
  }

  private normalizeComparableValue(value: any): any {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return value.toISOString();

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
      }
      return trimmed;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'boolean') return value;
    if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);

    return value;
  }

  private hasIncomingReadOnlyChange(nextValue: any, existingValue: any, hasExistingRecord: boolean): boolean {
    if (nextValue === undefined) return false;

    if (!hasExistingRecord) {
      const normalized = this.normalizeComparableValue(nextValue);
      return normalized !== null;
    }

    const normalizedNext = this.normalizeComparableValue(nextValue);
    const normalizedExisting = this.normalizeComparableValue(existingValue);
    return normalizedNext !== normalizedExisting;
  }

  private makeClientError(message: string, statusCode: number = 400): Error & { statusCode: number } {
    const err = new Error(message) as Error & { statusCode: number };
    err.statusCode = statusCode;
    return err;
  }

  private async enforceReadOnlyFieldConstraints(args: {
    collection: Collection;
    incomingData: Record<string, any>;
    existingRecord: any | null;
    req: any;
    overrideMeta: { fields: Set<string>; password: string };
  }) {
    const { collection, incomingData, existingRecord, req, overrideMeta } = args;
    if (!incomingData || typeof incomingData !== 'object') return;

    const changedOverrideableFields: string[] = [];
    const hasExistingRecord = Boolean(existingRecord);

    for (const field of collection.fields || []) {
      if (!field?.admin?.readOnly) continue;
      const name = String(field.name || '');
      if (!name || !Object.prototype.hasOwnProperty.call(incomingData, name)) continue;

      const incomingValue = incomingData[name];
      const snakeName = name.replace(/([A-Z])/g, '_$1').toLowerCase();
      const existingValue = hasExistingRecord
        ? (existingRecord?.[name] !== undefined ? existingRecord?.[name] : existingRecord?.[snakeName])
        : undefined;
      const changed = this.hasIncomingReadOnlyChange(incomingValue, existingValue, hasExistingRecord);
      if (!changed) continue;

      if (!this.isReadOnlyOverrideable(field)) {
        throw this.makeClientError(`Field "${field.label || name}" is read-only and cannot be modified.`);
      }

      if (!overrideMeta.fields.has(name)) {
        throw this.makeClientError(`Field "${field.label || name}" requires password override confirmation.`);
      }

      changedOverrideableFields.push(name);
    }

    if (!changedOverrideableFields.length) return;

    if (!overrideMeta.password) {
      throw this.makeClientError('Password is required for read-only field overrides.');
    }
    if (!this.auth) {
      throw this.makeClientError('Password verification is unavailable.', 503);
    }

    const userId = Number.parseInt(String(req?.user?.id || ''), 10);
    if (!userId) {
      throw this.makeClientError('Authentication is required for read-only field overrides.', 401);
    }

    const user = await this.db.findOne('users', { id: userId });
    if (!user) {
      throw this.makeClientError('User not found.', 404);
    }

    const passwordMatches = await this.auth.comparePassword(String(overrideMeta.password), String(user.password || ''));
    if (!passwordMatches) {
      throw this.makeClientError('Current password is invalid.');
    }
  }

  private assertPermalinkNotReserved(collection: Collection, data: Record<string, any>) {
    if (!collection || !data || typeof data !== 'object') return;

    const permalinkFields = ['slug', 'customPermalink', 'path', 'permalink'];
    const existingFields = new Set((collection.fields || []).map((field) => String(field?.name || '')));
    const targetFields = permalinkFields.filter((name) => existingFields.has(name) && data[name] !== undefined && data[name] !== null);
    if (!targetFields.length) return;

    const reservedRootSegments = new Set(RESERVED_PERMALINK_CONFIG.ROOT_SEGMENTS.map((segment) => String(segment).toLowerCase()));
    const reservedExactPaths = new Set(RESERVED_PERMALINK_CONFIG.EXACT_PATHS.map((path) => String(path).toLowerCase()));

    const extractCandidates = (value: any): string[] => {
      if (typeof value === 'string' || typeof value === 'number') return [String(value)];
      if (Array.isArray(value)) return value.flatMap((item) => extractCandidates(item));
      if (value && typeof value === 'object') {
        return Object.values(value).flatMap((item) => extractCandidates(item));
      }
      return [];
    };

    const normalizePath = (raw: string): string => {
      let value = String(raw || '').trim();
      if (!value) return '';
      if (/^https?:\/\//i.test(value)) {
        try {
          value = new URL(value).pathname || '';
        } catch {
          // Ignore malformed absolute URL and continue with raw value.
        }
      }
      value = value.split('?')[0].split('#')[0].trim();
      if (!value) return '';
      value = value.startsWith('/') ? value : `/${value}`;
      value = value.replace(/\/{2,}/g, '/');
      if (value.length > 1) value = value.replace(/\/+$/, '');
      return value.toLowerCase();
    };

    for (const fieldName of targetFields) {
      const values = extractCandidates(data[fieldName]);
      for (const rawValue of values) {
        const pathValue = normalizePath(rawValue);
        if (!pathValue || pathValue === '/') continue;
        const firstSegment = pathValue.replace(/^\/+/, '').split('/')[0]?.toLowerCase() || '';
        if (reservedRootSegments.has(firstSegment) || reservedExactPaths.has(pathValue)) {
          throw new Error(`Permalink "${pathValue}" is reserved and cannot be used.`);
        }
      }
    }
  }

  // --- Versioning Endpoints ---

  async getVersions(collection: Collection, req: any, res: Response) {
    try {
      const { id } = req.params;
      const { limit, offset } = req.query;
      const result = await this.versioningService.getVersions(collection.slug, id, {
        limit: limit ? parseInt(limit as string) : 10,
        offset: offset ? parseInt(offset as string) : 0
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getVersion(collection: Collection, req: any, res: Response) {
    try {
      const { id, version } = req.params;
      const result = await this.versioningService.getVersion(collection.slug, id, parseInt(version));
      if (!result) return res.status(404).json({ error: 'Version not found' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async restoreVersion(collection: Collection, req: any, res: Response) {
    try {
      const { id, version } = req.params;
      const restoredData = await this.versioningService.restoreVersion(collection, id, parseInt(version), req.user);
      res.json({
        message: `Successfully restored to version ${version}`,
        data: restoredData
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  private emitCollectionEvent(collection: Collection, action: string, payload: any): void {
    const event = `collection:${collection.slug}:${action}`;
    if (this.hooks) {
      this.hooks.emit(event, payload);
    }

    if (
      this.onSettingsUpdate &&
      collection.slug === 'settings' &&
      action === 'saved' &&
      payload &&
      payload.key
    ) {
      this.onSettingsUpdate(String(payload.key), payload.value);
    }
  }
}
