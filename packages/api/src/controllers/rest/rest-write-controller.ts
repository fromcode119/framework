import { Response } from 'express';
import { Collection, HookEventUtils } from '@fromcode119/core';
import { QueryHelper } from '../../services/query-helper';
import { RestControllerRuntime } from './rest-controller-runtime';

export class RestWriteController {
  constructor(private readonly runtime: RestControllerRuntime) {}

  async create(collection: Collection, req: any, res?: Response) {
    try {
      await this.runtime.accessPolicy.ensureCreateAllowed(collection, req);
      const extracted = this.runtime.fieldGuard.extractReadOnlyOverrideMetadata(req.body);
      let data = extracted.data;
      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.runtime.localization.getLocaleContext(req);

      await this.runtime.fieldGuard.enforceReadOnlyFieldConstraints({
        collection,
        incomingData: data,
        existingRecord: null,
        req,
        overrideMeta: extracted.overrideMeta,
      });

      data = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_CREATE, data);
      data = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_SAVE, data);

      if (res) {
        const errors = collection.fields
          .filter((field) => field.required && !data[field.name])
          .map((field) => `Field "${field.name}" is required`);
        if (errors.length > 0) {
          return res.status(400).json({ errors });
        }
      }

      this.runtime.fieldGuard.assertPermalinkNotReserved(collection, data);
      const insertData = await this.runtime.processor.processIncomingData(collection, data, table, { localeContext });
      const newItem = await this.runtime.insertCollectionRecord(collection, table, insertData);
      let finalItem = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_CREATE, newItem);
      finalItem = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_SAVE, finalItem);
      const recordId = this.runtime.resolveRecordIdentifier(collection, finalItem);

      if (collection.versions !== false) {
        await this.runtime.versioningService.createSnapshot(
          collection,
          recordId,
          finalItem,
          req.user,
          `Initial creation of ${collection.slug} record`
        );
      }

      this.runtime.logger.info(`Created record in ${collection.slug} : ${recordId}`);
      this.runtime.emitCollectionEvent(collection, 'created', finalItem);
      this.runtime.emitCollectionEvent(collection, 'saved', finalItem);

      const filtered = this.runtime.processor.filterHiddenFields(collection, finalItem, {
        localeContext,
        rawLocalized: false,
      });
      if (!res) {
        return filtered;
      }
      res.status(201).json(filtered);
    } catch (err: any) {
      const causeMessage = err?.cause?.message;
      this.runtime.logger.error(
        `Failed to create ${collection.slug} record: ${err.message}${causeMessage ? ` | cause: ${causeMessage}` : ''}`,
        { stack: err.stack }
      );
      if (!res) {
        throw err;
      }
      const pgCode = err.code || err?.cause?.code;
      const status = err?.statusCode || (pgCode === '23505' ? 409 : 500);
      const errorMessage = causeMessage ? `${err.message} | ${causeMessage}` : err.message;
      res.status(status).json({ error: errorMessage });
    }
  }

  async update(collection: Collection, req: any, res?: Response) {
    try {
      await this.runtime.accessPolicy.ensureUpdateAllowed(collection, req);
      const extracted = this.runtime.fieldGuard.extractReadOnlyOverrideMetadata(req.body);
      let data = extracted.data;
      const changeSummary = data._change_summary || `Update ${collection.slug} record`;
      if (data._change_summary) {
        delete data._change_summary;
      }

      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.runtime.localization.getLocaleContext(req);
      const primaryKey = collection.primaryKey || 'id';
      const where = { [primaryKey]: this.runtime.parseRecordIdentifier(collection, req.params.id) };
      const existing = await this.runtime.db.findOne(table, where);
      if (!existing) {
        if (!res) {
          return null;
        }
        return res.status(404).json({ error: 'Not found' });
      }

      await this.runtime.fieldGuard.enforceReadOnlyFieldConstraints({
        collection,
        incomingData: data,
        existingRecord: existing,
        req,
        overrideMeta: extracted.overrideMeta,
      });

      data = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_UPDATE, data);
      data = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.BEFORE_SAVE, data);

      if (res) {
        const errors = collection.fields
          .filter((field) => data[field.name] !== undefined && field.required && !data[field.name])
          .map((field) => `Field "${field.name}" cannot be empty`);
        if (errors.length > 0) {
          return res.status(400).json({ errors });
        }
      }

      this.runtime.fieldGuard.assertPermalinkNotReserved(collection, data);
      const updateData = await this.runtime.processor.processIncomingData(collection, data, table, {
        existingRecord: existing,
        localeContext,
      });
      const updated = await this.runtime.db.update(this.runtime.resolveWriteTarget(collection), where, updateData);
      if (!updated) {
        if (!res) {
          return null;
        }
        return res.status(404).json({ error: 'Not found' });
      }

      let finalItem = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_UPDATE, updated);
      finalItem = await this.runtime.callCollectionHook(collection, HookEventUtils.COLLECTION_HOOK_PHASES.AFTER_SAVE, finalItem);

      if (collection.versions !== false) {
        await this.runtime.versioningService.createSnapshot(collection, req.params.id, finalItem, req.user, changeSummary);
      }

      this.runtime.logger.info(`Updated record in ${collection.slug} : ${req.params.id}`);
      this.runtime.emitCollectionEvent(collection, 'updated', finalItem);
      this.runtime.emitCollectionEvent(collection, 'saved', finalItem);

      const filtered = this.runtime.processor.filterHiddenFields(collection, finalItem, {
        localeContext,
        rawLocalized: false,
      });
      if (!res) {
        return filtered;
      }
      res.json(filtered);
    } catch (err: any) {
      const causeMessage = err?.cause?.message;
      this.runtime.logger.error(
        `Failed to update ${collection.slug} record ${req.params.id}: ${err.message}${causeMessage ? ` | cause: ${causeMessage}` : ''}`,
        { stack: err.stack }
      );
      if (!res) {
        throw err;
      }
      const pgCode = err.code || err?.cause?.code;
      const status = err?.statusCode || (pgCode === '23505' ? 409 : 500);
      const errorMessage = causeMessage ? `${err.message} | ${causeMessage}` : err.message;
      res.status(status).json({ error: errorMessage });
    }
  }

  async delete(collection: Collection, req: any, res?: Response) {
    try {
      await this.runtime.accessPolicy.ensureDeleteAllowed(collection, req);
      const primaryKey = collection.primaryKey || 'id';
      const success = await this.runtime.db.delete(this.runtime.resolveWriteTarget(collection), {
        [primaryKey]: this.runtime.parseRecordIdentifier(collection, req.params.id),
      });

      if (success) {
        this.runtime.logger.info(`Deleted record in ${collection.slug} : ${req.params.id}`);
        this.runtime.emitCollectionEvent(collection, 'deleted', {
          id: this.runtime.parseRecordIdentifier(collection, req.params.id),
        });
      }

      if (!res) {
        return success;
      }
      res.json(success ? { success: true, id: req.params.id } : { error: 'Not found' });
    } catch (err: any) {
      this.runtime.logger.error(`Failed to delete ${collection.slug} record ${req.params.id}: ${err.message}`, { stack: err.stack });
      if (!res) {
        throw err;
      }
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async restoreVersion(collection: Collection, req: any, res: Response) {
    try {
      const restoredData = await this.runtime.versioningService.restoreVersion(
        collection,
        req.params.id,
        parseInt(req.params.version, 10),
        req.user
      );
      res.json({
        message: `Successfully restored to version ${req.params.version}`,
        data: restoredData,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}