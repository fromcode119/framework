import { Request, Response } from 'express';
import { Collection, HookEventUtils } from '@fromcode119/core';
import { QueryHelper } from '../../services/query-helper';
import { RestControllerRuntime } from './rest-controller-runtime';

export class RestBulkController {
  constructor(private readonly runtime: RestControllerRuntime) {}

  async bulkCreate(collection: Collection, req: any, res?: Response) {
    try {
      await this.runtime.accessPolicy.ensureCreateAllowed(collection, req);
      const items = Array.isArray(req.body) ? req.body : [req.body];
      const table = QueryHelper.getVirtualTable(collection);
      const results: any[] = [];
      const globalSummary = req.body._change_summary || `Bulk creation of ${collection.slug}`;
      const localeContext = await this.runtime.localization.getLocaleContext(req);

      for (let data of items) {
        data = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_CREATE, data);
        data = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_SAVE, data);
        this.runtime.fieldGuard.assertPermalinkNotReserved(collection, data);
        const individualSummary = data._change_summary || globalSummary;
        if (data._change_summary) {
          delete data._change_summary;
        }
        const insertData = await this.runtime.processor.processIncomingData(collection, data, table, { localeContext });
        const newItem = await this.runtime.insertCollectionRecord(collection, table, insertData);
        let finalItem = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_CREATE, newItem);
        finalItem = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_SAVE, finalItem);
        await this.runtime.versioningService.createSnapshot(
          collection,
          this.runtime.resolveRecordIdentifier(collection, finalItem),
          finalItem,
          req.user,
          individualSummary
        );
        this.runtime.emitCollectionEvent(collection, 'created', finalItem);
        this.runtime.emitCollectionEvent(collection, 'saved', finalItem);
        results.push(this.runtime.processor.filterHiddenFields(collection, finalItem, {
          localeContext,
          rawLocalized: false,
        }));
      }

      if (!res) {
        return results;
      }
      res.status(201).json(results);
    } catch (err: any) {
      if (!res) {
        throw err;
      }
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async bulkUpdate(collection: Collection, req: any, res?: Response) {
    try {
      await this.runtime.accessPolicy.ensureUpdateAllowed(collection, req);
      const ids = req.body.ids;
      const data = req.body.data;
      const changeSummary = req.body._change_summary || `Bulk update of ${collection.slug}`;
      if (!Array.isArray(ids) || ids.length === 0) {
        if (!res) {
          throw new Error('ids must be a non-empty array');
        }
        return res.status(400).json({ error: 'ids must be a non-empty array' });
      }

      const table = QueryHelper.getVirtualTable(collection);
      const writeTarget = this.runtime.resolveWriteTarget(collection);
      const primaryKey = collection.primaryKey || 'id';
      const localeContext = await this.runtime.localization.getLocaleContext(req);
      const extracted = this.runtime.fieldGuard.extractReadOnlyOverrideMetadata(data);
      let updateData = extracted.data;
      if (updateData._change_summary) {
        delete updateData._change_summary;
      }

      updateData = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_UPDATE, updateData);
      updateData = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_SAVE, updateData);
      this.runtime.fieldGuard.assertPermalinkNotReserved(collection, updateData);

      const results: any[] = [];
      for (const id of ids) {
        const where = {
          [primaryKey]: primaryKey === 'id' ? parseInt(id, 10) : id,
        };
        const existing = await this.runtime.db.findOne(table, where);
        if (!existing) {
          continue;
        }

        await this.runtime.fieldGuard.enforceReadOnlyFieldConstraints({
          collection,
          incomingData: updateData,
          existingRecord: existing,
          req,
          overrideMeta: extracted.overrideMeta,
        });

        const processedUpdate = await this.runtime.processor.processIncomingData(collection, updateData, table, {
          existingRecord: existing,
          localeContext,
        });
        const updated = await this.runtime.db.update(writeTarget, where, processedUpdate);
        if (!updated) {
          continue;
        }

        let finalItem = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_UPDATE, updated);
        finalItem = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_SAVE, finalItem);
        await this.runtime.versioningService.createSnapshot(collection, id, finalItem, req.user, changeSummary);
        this.runtime.emitCollectionEvent(collection, 'updated', finalItem);
        this.runtime.emitCollectionEvent(collection, 'saved', finalItem);
        results.push(this.runtime.processor.filterHiddenFields(collection, finalItem, {
          localeContext,
          rawLocalized: false,
        }));
      }

      if (!res) {
        return results;
      }
      res.json(results);
    } catch (err: any) {
      if (!res) {
        throw err;
      }
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async bulkDelete(collection: Collection, req: any, res?: Response) {
    try {
      await this.runtime.accessPolicy.ensureDeleteAllowed(collection, req);
      const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
      if (ids.length === 0) {
        if (!res) {
          throw new Error('ids must be a non-empty array');
        }
        return res.status(400).json({ error: 'ids must be a non-empty array' });
      }

      const table = QueryHelper.getVirtualTable(collection);
      const primaryKey = collection.primaryKey || 'id';
      const success = await this.runtime.db.delete(
        table,
        this.runtime.db.inArray(table[primaryKey], ids.map((id: any) => primaryKey === 'id' ? parseInt(id, 10) : id))
      );

      if (success) {
        this.runtime.emitCollectionEvent(collection, 'deleted', {
          ids: ids.map((id: any) => primaryKey === 'id' ? parseInt(id, 10) : id),
          count: ids.length,
        });
      }

      if (!res) {
        return success;
      }
      res.json({ success, count: ids.length });
    } catch (err: any) {
      if (!res) {
        throw err;
      }
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async import(collection: Collection, req: Request, res: Response) {
    try {
      await this.runtime.accessPolicy.ensureCreateAllowed(collection, req);
      const items = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Payload must be an array of records' });
      }

      const table = QueryHelper.getVirtualTable(collection);
      const results: any[] = [];
      const localeContext = await this.runtime.localization.getLocaleContext(req as any);
      for (const item of items) {
        const primaryKey = collection.primaryKey || 'id';
        const itemData = { ...item };
        delete itemData[primaryKey];
        this.runtime.fieldGuard.assertPermalinkNotReserved(collection, itemData);
        try {
          const insertData = await this.runtime.processor.processIncomingData(collection, itemData, table, { localeContext });
          const newItem = await this.runtime.insertCollectionRecord(collection, table, insertData);
          results.push({ id: this.runtime.resolveRecordIdentifier(collection, newItem), status: 'success' });
        } catch (error: any) {
          results.push({
            item: item.name || item.title || 'unknown',
            status: 'error',
            error: error.message,
          });
        }
      }

      res.json({
        total: items.length,
        success: results.filter((result) => result.status === 'success').length,
        errors: results.filter((result) => result.status === 'error'),
      });
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }
}