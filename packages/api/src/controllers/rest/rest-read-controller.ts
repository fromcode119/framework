import { Request, Response } from 'express';
import { Collection, CoercionUtils } from '@fromcode119/core';
import { users } from '@fromcode119/database';
import { QueryHelper } from '../../services/query-helper';
import { RestControllerRuntime } from './rest-controller-runtime';

export class RestReadController {
  constructor(private readonly runtime: RestControllerRuntime) {}

  async find(collection: Collection, req: any, res?: Response) {
    try {
      const { limit, page, offset, sort, search, locale_mode, ...filters } = req.query || {};
      delete (filters as any).locale;
      delete (filters as any).fallback_locale;
      delete (filters as any).locale_mode;

      const accessConstraints = await this.runtime.accessPolicy.resolveReadConstraints(collection, req);
      const effectiveFilters: Record<string, unknown> = { ...filters, ...accessConstraints };
      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.runtime.localization.getLocaleContext(req);
      const rawLocalized = String(locale_mode || '').toLowerCase() === 'raw';
      const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
      const isPreview = CoercionUtils.toBoolean(req.query?.preview) || CoercionUtils.toBoolean(req.query?.draft);

      if (!effectiveFilters.status && !isAdmin && !isPreview && collection.fields.find((field) => field.name === 'status')) {
        effectiveFilters.status = 'published';
      }

      const whereClause = QueryHelper.buildWhereClause(this.runtime.db, collection, table, effectiveFilters, search);
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
        const userIds = [...new Set(rowsResult.map((row) => row.updated_by).filter(Boolean))];
        if (userIds.length > 0) {
          const userData = await this.runtime.db.find(users, {
            where: this.runtime.db.inArray(users.id, userIds),
          });
          const userMap = new Map(userData.map((user) => [user.id, user.email || user.username]));
          rowsResult = rowsResult.map((row) => ({
            ...row,
            updated_by: userMap.get(row.updated_by) || row.updated_by,
          }));
        }
      }

      const total = await this.runtime.db.count(collection.tableName || collection.slug, { where: whereClause });
      const result = {
        docs: this.runtime.processor.filterHiddenFields(collection, rowsResult, { localeContext, rawLocalized }),
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
      this.runtime.logger.error(`Failed to find ${collection.slug} records: ${err.message}`, { stack: err.stack });
      if (!res) {
        throw err;
      }
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async findOne(collection: Collection, req: any, res?: Response) {
    try {
      const accessConstraints = await this.runtime.accessPolicy.resolveReadConstraints(collection, req);
      const table = QueryHelper.getVirtualTable(collection);
      const localeContext = await this.runtime.localization.getLocaleContext(req);
      const rawLocalized = String(req.query?.locale_mode || '').toLowerCase() === 'raw';
      const id = this.runtime.parseRecordIdentifier(collection, req.params.id);
      const primaryKey = collection.primaryKey || 'id';
      const result = await this.runtime.db.findOne(table, { [primaryKey]: id });

      if (!result) {
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

      const statusField = collection.fields.find((field) => field.name === 'status');
      if (statusField && result.status !== 'published') {
        const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
        const isPreview = CoercionUtils.toBoolean(req.query?.preview) || CoercionUtils.toBoolean(req.query?.draft);
        if (!isAdmin && !isPreview) {
          if (!res) {
            return null;
          }
          return res.status(404).json({ error: 'Not found (draft)' });
        }
      }

      const filtered = this.runtime.processor.filterHiddenFields(collection, result, { localeContext, rawLocalized });
      if (!res) {
        return filtered;
      }
      res.json(filtered);
    } catch (err: any) {
      this.runtime.logger.error(`Failed to findOne ${collection.slug} record ${req.params.id}: ${err.message}`, { stack: err.stack });
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

  async getSuggestions(collection: Collection, req: Request, res: Response) {
    try {
      await this.runtime.accessPolicy.resolveReadConstraints(collection, req);
      const field = req.params.field;
      const query = (req.query as any).q;
      res.json(await this.runtime.suggestionService.getSuggestions(collection, field, query));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async export(collection: Collection, req: Request, res: Response) {
    try {
      await this.runtime.accessPolicy.resolveReadConstraints(collection, req);
      const format = req.query.format || 'json';
      const table = QueryHelper.getVirtualTable(collection);
      const docs = await this.runtime.db.find(table, { limit: 10000 });
      if (format === 'csv') {
        const fields = collection.fields.map((field) => field.name);
        const csvRows = [
          fields.join(','),
          ...docs.map((doc: any) => fields.map((field) => {
            const value = doc[field];
            const stringValue = value === null || value === undefined
              ? ''
              : (typeof value === 'object' ? JSON.stringify(value) : String(value));
            return `"${stringValue.replace(/"/g, '""')}"`;
          }).join(',')),
        ];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${collection.slug}_export.csv`);
        return res.send(csvRows.join('\n'));
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${collection.slug}_export.json`);
      res.json(docs);
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err.message });
    }
  }

  async getVersions(collection: Collection, req: any, res: Response) {
    try {
      const id = req.params.id;
      const limit = req.query.limit;
      const offset = req.query.offset;
      res.json(await this.runtime.versioningService.getVersions(collection.slug, id, {
        limit: limit ? parseInt(limit as string, 10) : 10,
        offset: offset ? parseInt(offset as string, 10) : 0,
      }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getVersion(collection: Collection, req: any, res: Response) {
    try {
      const id = req.params.id;
      const version = parseInt(req.params.version, 10);
      const result = await this.runtime.versioningService.getVersion(collection.slug, id, version);
      if (!result) {
        return res.status(404).json({ error: 'Version not found' });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}