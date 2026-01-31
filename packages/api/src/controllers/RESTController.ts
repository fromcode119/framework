import { Request, Response } from 'express';
import { Collection, Logger, RecordVersions } from '@fromcode/core';
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
    private onSettingsUpdate?: (key: string, value: any) => void
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

    const table = createDynamicTable({
      slug: collection.tableName || collection.slug,
      fields: collection.fields.map(f => ({ 
        name: f.name, 
        type: f.type 
      })),
      primaryKey: collection.primaryKey || 'id',
      timestamps: useTimestamps
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

  async find(collection: Collection, req: Request, res: Response) {
    try {
      const { limit = 10, offset = 0, sort, search, ...filters } = req.query as any;
      const table = this.getVirtualTable(collection);
      
      const whereChunks: any[] = [];
      const isAdmin = (req as any).user && (req as any).user.roles && (req as any).user.roles.includes('admin');
      const isPreview = req.query.preview === '1' || req.query.draft === '1';

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

      res.json({
        docs: this.filterHiddenFields(collection, rowsResult),
        totalDocs: total,
        limit: limitVal,
        offset: offsetVal,
        totalPages: Math.ceil(total / limitVal),
        page: Math.floor(offsetVal / limitVal) + 1
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async findOne(collection: Collection, req: Request, res: Response) {
    try {
      const { id } = req.params;
      const pk = collection.primaryKey || 'id';
      const table = this.getVirtualTable(collection);
      const result = await this.db.findOne(table, { [pk]: pk === 'id' ? parseInt(id) : id });
      
      if (!result) return res.status(404).json({ error: 'Not found' });

      // Handle Status/Visibility
      const statusField = collection.fields.find(f => f.name === 'status');
      if (statusField && result.status !== 'published') {
        const isAdmin = (req as any).user && (req as any).user.roles && (req as any).user.roles.includes('admin');
        const isPreview = req.query.preview === '1' || req.query.draft === '1';
        if (!isAdmin && !isPreview) return res.status(404).json({ error: 'Not found (draft)' });
      }
      
      res.json(this.filterHiddenFields(collection, result));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async create(collection: Collection, req: Request, res: Response) {
    try {
      const data = req.body;
      const table = this.getVirtualTable(collection);
      
      const errors = collection.fields.filter(f => f.required && !data[f.name]).map(f => `Field "${f.name}" is required`);
      if (errors.length > 0) return res.status(400).json({ errors });

      const insertData = await this.processIncomingData(collection, data, table);
      const newItem = await this.db.insert(table, insertData);

      await this.versioningService.createSnapshot(collection, newItem.id, newItem, (req as any).user, `Initial creation of ${collection.slug} record`);
      res.status(201).json(this.filterHiddenFields(collection, newItem));
    } catch (err: any) {
      res.status(err.code === '23505' ? 409 : 500).json({ error: err.message });
    }
  }

  async update(collection: Collection, req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;
      const pk = collection.primaryKey || 'id';
      const table = this.getVirtualTable(collection);
      const where = { [pk]: pk === 'id' ? parseInt(id) : id };

      const errors = collection.fields.filter(f => data[f.name] !== undefined && f.required && !data[f.name]).map(f => `Field "${f.name}" cannot be empty`);
      if (errors.length > 0) return res.status(400).json({ errors });

      const updateData = await this.processIncomingData(collection, data, table);
      const updated = await this.db.update(table, where, updateData);
      
      if (!updated) return res.status(404).json({ error: 'Not found' });

      await this.versioningService.createSnapshot(collection, id, updated, (req as any).user, `Update ${collection.slug} record`);
      if (collection.slug === 'settings' && this.onSettingsUpdate) this.onSettingsUpdate(id, data.value);
      
      res.json(this.filterHiddenFields(collection, updated));
    } catch (err: any) {
      res.status(err.code === '23505' ? 409 : 500).json({ error: err.message });
    }
  }

  async delete(collection: Collection, req: Request, res: Response) {
    try {
      const { id } = req.params;
      const pk = collection.primaryKey || 'id';
      const table = this.getVirtualTable(collection);
      const success = await this.db.delete(table, { [pk]: pk === 'id' ? parseInt(id) : id });
      res.json(success ? { success: true, id } : { error: 'Not found' });
    } catch (err: any) {
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
}
