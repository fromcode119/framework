import express, { Request, Response } from 'express';
import { Collection, Logger, RecordVersions, HookManager } from '@fromcode/core';
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
import { ActivityService } from '../services/ActivityService';
import { VersioningService } from '../services/VersioningService';
import { SuggestionService } from '../services/SuggestionService';

export class RESTController {
  private virtualTables: Map<string, any> = new Map();
  private logger = new Logger({ namespace: 'REST' });
  private activityService: ActivityService;
  private versioningService: VersioningService;
  private suggestionService: SuggestionService;

  constructor(
    private db: IDatabaseManager, 
    private auth?: AuthManager,
    private onSettingsUpdate?: (key: string, value: any) => void,
    private hooks?: HookManager
  ) {
    this.activityService = new ActivityService(db);
    this.versioningService = new VersioningService(db);
    this.suggestionService = new SuggestionService(db);
  }

  /**
   * Generates or retrieves a Drizzle table object for a given collection definition.
   */
  private getVirtualTable(collection: Collection) {
    if (this.virtualTables.has(collection.slug)) {
      return this.virtualTables.get(collection.slug);
    }

    const useTimestamps = collection.timestamps !== undefined ? collection.timestamps : true;
    const hasWorkflow = !!collection.workflow;

    const table = createDynamicTable({
      slug: collection.tableName || collection.slug,
      fields: collection.fields.map(f => ({ 
        name: f.name, 
        type: f.type 
      })),
      primaryKey: collection.primaryKey || 'id',
      timestamps: useTimestamps,
      workflow: hasWorkflow
    });

    // Manually add timestamp column definitions to the table object if they are missing
    // Drizzle table objects need the column definitions to generate correct SQL in where/orderBy
    if (useTimestamps) {
      if (!(table as any).createdAt) {
        (table as any).createdAt = timestamp('created_at', { withTimezone: true });
      }
      if (!(table as any).updatedAt) {
        (table as any).updatedAt = timestamp('updated_at', { withTimezone: true });
      }
    }

    this.virtualTables.set(collection.slug, table);
    return table;
  }

  private filterHiddenFields(collection: Collection, data: any) {
    if (!data) return data;
    
    // If it's an array of results
    if (Array.isArray(data)) {
      return data.map(item => this.filterHiddenFields(collection, item));
    }

    const cleanData = { ...data };
    collection.fields.forEach(field => {
      if (field.admin?.hidden) {
        delete cleanData[field.name];
      }
    });
    return cleanData;
  }

  private async processIncomingData(collection: Collection, data: any, table: any) {
    const processedData: any = {};
    for (const key of Object.keys(data)) {
      if (table[key]) {
        let value = data[key];
        
        // Skip system fields that should be handled by the ORM/DB
        if (key === 'createdAt') continue;
        if (key === 'updatedAt' && collection.slug !== 'settings') continue;

        // Special handling for passwords in Users collection
        if (collection.slug === 'users' && key === 'password' && this.auth && value) {
          value = await this.auth.hashPassword(value);
        }
        
        // Postgres JSONB coercion: ensure values are valid JSON for the driver
        const fieldConfig = collection.fields.find(f => f.name === key);
        const isJsonType = fieldConfig && ['json', 'relationship', 'upload', 'richText'].includes(fieldConfig.type);
        const isDateType = fieldConfig && fieldConfig.type === 'date';
        
        if (isJsonType) {
          if (value === '' || value === undefined || value === null) {
            value = null;
          }
        }

        if (isDateType && value && typeof value === 'string') {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            value = date;
          }
        }

        processedData[key] = value;
      }
    }
    return processedData;
  }

  /**
   * Universal find (handles both REST and Internal/GraphQL)
   */
  async find(collection: Collection, req: any, res?: Response) {
    try {
      const { limit = 10, offset = 0, sort, search, ...filters } = req.query || {};
      const table = this.getVirtualTable(collection);
      
      const whereChunks: any[] = [];
      const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
      const isPreview = String(req.query?.preview) === '1' || String(req.query?.draft) === '1';

      // 1. Handle Status/Visibility (Governance Layer)
      const statusField = collection.fields.find(f => f.name === 'status');
      if (statusField && !filters.status) {
        if (!isAdmin && !isPreview) {
          whereChunks.push(eq(table['status'], 'published'));
        }
      }

      // Handle Search (across all text/textarea fields) using ilike
      if (search) {
        const searchFields = collection.fields.filter(f => f.type === 'text' || f.type === 'textarea');
        if (searchFields.length > 0) {
          const searchConditions = searchFields.map(f => ilike(table[f.name], `%${search}%`));
          whereChunks.push(or(...searchConditions));
        }
      }

      // Handle Filters
      Object.entries(filters).forEach(([key, value]) => {
        const column = table[key];
        if (column) {
          whereChunks.push(eq(column, value));
        } else if (key === 'created_at' && table['createdAt']) {
          whereChunks.push(eq(table['createdAt'], value));
        } else if (key === 'updated_at' && table['updatedAt']) {
          whereChunks.push(eq(table['updatedAt'], value));
        }
      });

      const whereClause = whereChunks.length > 0 ? and(...whereChunks) : undefined;
      const pk = collection.primaryKey || 'id';
      let orderBy: any[] = [table[pk] ? desc(table[pk]) : desc(sql`1`)]; 
      
      if (sort) {
        const isDesc = sort.startsWith('-');
        const fieldName = isDesc ? sort.substring(1) : sort;
        if (table[fieldName]) {
          orderBy = [isDesc ? desc(table[fieldName]) : asc(table[fieldName])];
        }
      }
      
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
        docs: this.filterHiddenFields(collection, rowsResult),
        totalDocs: total,
        limit: limitVal,
        offset: offsetVal,
        totalPages: Math.ceil(total / limitVal),
        page: Math.floor(offsetVal / limitVal) + 1
      };

      if (!res) return result;
      res.json(result);
    } catch (err: any) {
      if (!res) throw err;
      res.status(500).json({ error: err.message });
    }
  }

  async findOne(collection: Collection, req: any, res?: Response) {
    try {
      const { id } = req.params;
      const pk = collection.primaryKey || 'id';
      const table = this.getVirtualTable(collection);
      
      const result = await this.db.findOne(table, { [pk]: pk === 'id' ? parseInt(id) : id });
      
      if (!result) {
        if (!res) return null;
        return res.status(404).json({ error: 'Not found' });
      }

      // Handle Status/Visibility
      const statusField = collection.fields.find(f => f.name === 'status');
      if (statusField && result.status !== 'published') {
        const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
        const isPreview = String(req.query?.preview) === '1' || String(req.query?.draft) === '1';
        if (!isAdmin && !isPreview) {
          if (!res) return null;
          return res.status(404).json({ error: 'Not found (draft)' });
        }
      }
      
      const filtered = this.filterHiddenFields(collection, result);
      if (!res) return filtered;
      res.json(filtered);
    } catch (err: any) {
      if (!res) throw err;
      res.status(500).json({ error: err.message });
    }
  }

  async create(collection: Collection, req: any, res?: Response) {
    try {
      let data = req.body;
      const table = this.getVirtualTable(collection);
      
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

      const insertData = await this.processIncomingData(collection, data, table);
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
      
      const filtered = this.filterHiddenFields(collection, finalItem);
      if (!res) return filtered;
      res.status(201).json(filtered);
    } catch (err: any) {
      if (!res) throw err;
      res.status(err.code === '23505' ? 409 : 500).json({ error: err.message });
    }
  }

  async update(collection: Collection, req: any, res?: Response) {
    try {
      const { id } = req.params;
      let data = req.body;
      const changeSummary = data._change_summary || `Update ${collection.slug} record`;
      
      // Strip metadata
      if (data._change_summary) {
        delete data._change_summary;
      }

      const pk = collection.primaryKey || 'id';
      const table = this.getVirtualTable(collection);
      
      const where = { [pk]: pk === 'id' ? parseInt(id) : id };

      // Hooks: Before Update
      if (this.hooks) {
        data = await this.hooks.call(`collection:${collection.slug}:beforeUpdate`, data);
        data = await this.hooks.call(`collection:${collection.slug}:beforeSave`, data);
      }

      if (res) {
        const errors = collection.fields.filter(f => data[f.name] !== undefined && f.required && !data[f.name]).map(f => `Field "${f.name}" cannot be empty`);
        if (errors.length > 0) return res.status(400).json({ errors });
      }

      const updateData = await this.processIncomingData(collection, data, table);
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
      
      const filtered = this.filterHiddenFields(collection, finalItem);
      if (!res) return filtered;
      res.json(filtered);
    } catch (err: any) {
      if (!res) throw err;
      res.status(err.code === '23505' ? 409 : 500).json({ error: err.message });
    }
  }

  async delete(collection: Collection, req: any, res?: Response) {
    try {
      const { id } = req.params;
      const pk = collection.primaryKey || 'id';
      const table = this.getVirtualTable(collection);
      const success = await this.db.delete(table, { [pk]: pk === 'id' ? parseInt(id) : id });
      
      if (!res) return success;
      res.json(success ? { success: true, id } : { error: 'Not found' });
    } catch (err: any) {
      if (!res) throw err;
      res.status(500).json({ error: err.message });
    }
  }

  async bulkCreate(collection: Collection, req: any, res?: Response) {
    try {
      const items = Array.isArray(req.body) ? req.body : [req.body];
      const table = this.getVirtualTable(collection);
      const results: any[] = [];
      const globalSummary = req.body._change_summary || `Bulk creation of ${collection.slug}`;

      for (let data of items) {
        if (this.hooks) {
          data = await this.hooks.call(`collection:${collection.slug}:beforeCreate`, data);
          data = await this.hooks.call(`collection:${collection.slug}:beforeSave`, data);
        }
        
        const individualSummary = data._change_summary || globalSummary;
        if (data._change_summary) delete data._change_summary;

        const insertData = await this.processIncomingData(collection, data, table);
        const newItem = await this.db.insert(table, insertData);
        
        let finalItem = newItem;
        if (this.hooks) {
          finalItem = await this.hooks.call(`collection:${collection.slug}:afterCreate`, newItem);
          finalItem = await this.hooks.call(`collection:${collection.slug}:afterSave`, finalItem);
        }
        await this.versioningService.createSnapshot(collection, finalItem.id, finalItem, req.user, individualSummary);
        results.push(this.filterHiddenFields(collection, finalItem));
      }

      if (!res) return results;
      res.status(201).json(results);
    } catch (err: any) {
      if (!res) throw err;
      res.status(500).json({ error: err.message });
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

      const table = this.getVirtualTable(collection);
      const pk = collection.primaryKey || 'id';
      
      let updateData = data;
      if (updateData._change_summary) delete updateData._change_summary;

      if (this.hooks) {
        updateData = await this.hooks.call(`collection:${collection.slug}:beforeUpdate`, updateData);
        updateData = await this.hooks.call(`collection:${collection.slug}:beforeSave`, updateData);
      }

      const processedUpdate = await this.processIncomingData(collection, updateData, table);
      
      // Update one by one to ensure hooks and versioning trigger correctly per item
      const results: any[] = [];
      for (const id of ids) {
        const where = { [pk]: pk === 'id' ? parseInt(id) : id };
        const updated = await this.db.update(table, where, processedUpdate);
        if (updated) {
          let finalItem = updated;
          if (this.hooks) {
            finalItem = await this.hooks.call(`collection:${collection.slug}:afterUpdate`, updated);
            finalItem = await this.hooks.call(`collection:${collection.slug}:afterSave`, finalItem);
          }
          await this.versioningService.createSnapshot(collection, id, finalItem, req.user, changeSummary);
          results.push(this.filterHiddenFields(collection, finalItem));
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

      const table = this.getVirtualTable(collection);
      const pk = collection.primaryKey || 'id';
      
      const success = await this.db.delete(table, inArray(table[pk], ids.map((id: any) => pk === 'id' ? parseInt(id) : id)));
      
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
      res.json(await this.suggestionService.getSuggestions(collection, field, q, this.getVirtualTable(collection)));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async export(collection: Collection, req: Request, res: Response) {
    try {
      const { format = 'json' } = req.query;
      const table = this.getVirtualTable(collection);
      
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

      const table = this.getVirtualTable(collection);
      const results: any[] = [];
      
      for (const item of items) {
        const pk = collection.primaryKey || 'id';
        const itemData = { ...item };
        delete itemData[pk]; 
        
        try {
          const insertData = await this.processIncomingData(collection, itemData, table);
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
}
