import { Request, Response, NextFunction } from 'express';
import { Collection, Logger, RecordVersions } from '@fromcode/core';
import { AuthManager } from '@fromcode/auth';
import { 
  IDatabaseManager, 
  sql, 
  count, 
  and, 
  or,
  eq, 
  ilike,
  isNotNull,
  pgTable, 
  serial, 
  text, 
  numeric, 
  boolean, 
  timestamp, 
  jsonb,
  desc,
  asc,
  createDynamicTable
} from '@fromcode/database';

export class RESTController {
  private virtualTables: Map<string, any> = new Map();
  private logger = new Logger({ namespace: 'REST' });

  constructor(
    private db: IDatabaseManager, 
    private auth?: AuthManager,
    private onSettingsUpdate?: (key: string, value: any) => void
  ) {}

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
      fields: collection.fields.map(f => ({ name: f.name, type: f.type })),
      primaryKey: collection.primaryKey || 'id',
      timestamps: useTimestamps
    });

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

  async find(collection: Collection, req: Request, res: Response) {
    try {
      const { limit = 10, offset = 0, sort, search, ...filters } = req.query as any;
      const table = this.getVirtualTable(collection);
      
      const whereChunks: any[] = [];
      const isAdmin = (req as any).user && (req as any).user.roles && (req as any).user.roles.includes('admin');
      const isPreview = req.query.preview === '1' || req.query.draft === '1';

      // 1. Handle Status/Visibility (Governance Layer)
      // If the collection has a 'status' field, we default to 'published' unless it's an admin preview
      const statusField = collection.fields.find(f => f.name === 'status');
      if (statusField && !filters.status) {
        if (isAdmin && isPreview) {
          // Admin preview: don't inject any status filter (show all)
        } else {
          // Public or non-preview: only show published
          whereChunks.push(eq(table['status'], 'published'));
        }
      }

      // Handle Search (across all text/textarea fields) using ilike
      if (search) {
        const searchFields = collection.fields
          .filter(f => f.type === 'text' || f.type === 'textarea');
        
        if (searchFields.length > 0) {
          const searchConditions = searchFields.map(f => ilike(table[f.name], `%${search}%`));
          whereChunks.push(or(...searchConditions));
        }
      }

      // Handle Filters
      Object.entries(filters).forEach(([key, value]) => {
        if (table[key]) {
          whereChunks.push(eq(table[key], value));
        }
      });

      const whereClause = whereChunks.length > 0 
        ? and(...whereChunks)
        : undefined;
      
      const pk = collection.primaryKey || 'id';
      let orderBy: any[] = [table[pk] ? desc(table[pk]) : desc(sql`1`)]; 
      
      if (sort) {
        const isDesc = sort.startsWith('-');
        const fieldName = isDesc ? sort.substring(1) : sort;
        // Search in both defined fields and the table object (which might have internal fields like updatedAt)
        const hasField = table[fieldName] || collection.fields.some(f => f.name === fieldName);
        
        if (hasField && table[fieldName]) {
          orderBy = [isDesc ? desc(table[fieldName]) : asc(table[fieldName])];
        } else {
          this.logger.debug(`Ignoring invalid sort field: ${fieldName} for collection ${collection.slug}`);
        }
      }
      
      const limitVal = Math.min(parseInt(limit as string) || 10, 100);
      const offsetVal = parseInt(offset as string) || 0;

      const rowsResult = await this.db.find(table, {
        where: whereChunks.length > 0 ? whereClause : undefined,
        limit: limitVal,
        offset: offsetVal,
        orderBy: orderBy
      });

      const total = await this.db.count(collection.tableName || collection.slug, whereChunks.length > 0 ? whereClause : undefined);

      res.json({
        docs: this.filterHiddenFields(collection, rowsResult),
        totalDocs: total,
        limit: limitVal,
        offset: offsetVal,
        totalPages: Math.ceil(total / limitVal),
        page: Math.floor(offsetVal / limitVal) + 1
      });
    } catch (err: any) {
      this.logger.error(`Find error in ${collection.slug}:`, err);
      res.status(500).json({ error: err.message });
    }
  }

  async findOne(collection: Collection, req: Request, res: Response) {
    try {
      const { id } = req.params;
      const pk = collection.primaryKey || 'id';
      const table = this.getVirtualTable(collection);
      
      const where: any = {};
      where[pk] = pk === 'id' ? parseInt(id) : id;
      
      const result = await this.db.findOne(table, where);
      
      if (!result) {
        return res.status(404).json({ error: 'Not found' });
      }

      // 1. Handle Status/Visibility (Governance Layer)
      const statusField = collection.fields.find(f => f.name === 'status');
      if (statusField && result.status !== 'published') {
        const isAdmin = (req as any).user && (req as any).user.roles && (req as any).user.roles.includes('admin');
        const isPreview = req.query.preview === '1' || req.query.draft === '1';

        if (!isAdmin || !isPreview) {
          return res.status(404).json({ error: 'Not found (draft)' });
        }
      }
      
      res.json(this.filterHiddenFields(collection, result));
    } catch (err: any) {
      this.logger.error(`FindOne error in ${collection.slug}:`, err);
      res.status(500).json({ error: err.message });
    }
  }

  async create(collection: Collection, req: Request, res: Response) {
    try {
      const data = req.body;
      const tableName = collection.tableName || collection.slug;
      const table = this.getVirtualTable(collection);
      
      // Basic validation
      const errors: string[] = [];
      collection.fields.forEach(field => {
        if (field.required && (data[field.name] === undefined || data[field.name] === null || data[field.name] === '')) {
          errors.push(`Field "${field.name}" is required`);
        }
      });

      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }

      // Filter data to only include valid fields
      const insertData: any = {};
      for (const key of Object.keys(data)) {
        if (table[key]) {
          let value = data[key];
          
          // Special handling for passwords in Users collection
          if (collection.slug === 'users' && key === 'password' && this.auth && value) {
            value = await this.auth.hashPassword(value);
          }
          
          // Postgres JSONB coercion: ensure values are valid JSON for the driver
          const fieldConfig = collection.fields.find(f => f.name === key);
          const isJsonType = fieldConfig && ['json', 'relationship', 'upload', 'richText'].includes(fieldConfig.type);
          
          if (isJsonType) {
            if (value === '' || value === undefined || value === null) {
              value = null;
            }
          }

          insertData[key] = value;
        }
      }

      const newItem = await this.db.insert(table, insertData);

      // Create Initial Version Snapshot
      try {
        if (collection.slug !== '_system_record_versions' && collection.slug !== '_system_logs') {
          const versionsTable = this.getVirtualTable(RecordVersions);
          await this.db.insert(versionsTable, {
            ref_id: String(newItem.id),
            ref_collection: collection.slug,
            version_data: newItem,
            updated_by: (req as any).user?.id || null,
            change_summary: `Initial creation of ${collection.slug} record`
          });
        }
      } catch (versionErr) {
        this.logger.error(`Failed to create initial version snapshot for ${collection.slug}:`, versionErr);
      }
      
      res.status(201).json(this.filterHiddenFields(collection, newItem));
    } catch (err: any) {
      if (err.code === '23505' || err.code === 'ER_DUP_ENTRY' || err.message.includes('UNIQUE constraint failed')) {
        const detail = err.detail || err.message || '';
        const match = detail.match(/\((.*?)\)=\((.*?)\)/) || detail.match(/UNIQUE constraint failed: (.*)/);
        const field = match ? (match[1].split('.').pop() || 'field') : 'field';
        
        return res.status(409).json({ 
          error: `Duplicate entry found: A record with this ${field.replace(/_/g, ' ')} already exists.`
        });
      }
      this.logger.error(`Create error in ${collection.slug}:`, err);
      res.status(500).json({ error: err.message });
    }
  }

  async update(collection: Collection, req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;
      const tableName = collection.tableName || collection.slug;
      const table = this.getVirtualTable(collection);
      
      // 1. Fetch current state before update (for snapshotting)
      const pk = collection.primaryKey || 'id';
      const where: any = {};
      where[pk] = pk === 'id' ? parseInt(id) : id;
      const beforeUpdate = await this.db.findOne(table, where);

      if (!beforeUpdate) {
        return res.status(404).json({ error: 'Not found' });
      }

      // 2. Basic validation
      const errors: string[] = [];
      collection.fields.forEach(field => {
        if (data[field.name] !== undefined) {
          if (field.required && (data[field.name] === null || data[field.name] === '')) {
            errors.push(`Field "${field.name}" cannot be empty`);
          }
        }
      });

      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }

      // Filter data to only include valid fields and strip internal/excluded fields
      const updateData: any = {};
      const excludedFields = [pk, 'createdAt', 'updatedAt', 'created_at', 'updated_at'];
      
      for (const key of Object.keys(data)) {
        if (table[key] && !excludedFields.includes(key)) {
          let value = data[key];
          
          // Special handling for passwords in Users collection
          if (collection.slug === 'users' && key === 'password' && this.auth && value) {
            value = await this.auth.hashPassword(value);
          }

          // Postgres JSONB coercion: ensure values are valid JSON for the driver
          const fieldConfig = collection.fields.find(f => f.name === key);
          const isJsonType = fieldConfig && ['json', 'relationship', 'upload', 'richText'].includes(fieldConfig.type);
          
          if (isJsonType) {
            if (value === '' || value === undefined || value === null) {
              value = null;
            }
          }

          updateData[key] = value;
        }
      }
      
      const updated = await this.db.update(table, where, updateData);
      
      if (!updated) {
        return res.status(404).json({ error: 'Not found' });
      }

      // 3. Create Version Snapshot
      try {
        const isSystemCollection = collection.slug.startsWith('_system_') || ['settings', 'users', 'media', '_system_record_versions'].includes(collection.slug);
        
        // We version everything except the versions table itself and transient logs
        if (collection.slug !== '_system_record_versions' && collection.slug !== '_system_logs') {
          const versionsTable = this.getVirtualTable(RecordVersions);
          await this.db.insert(versionsTable, {
            ref_id: String(id),
            ref_collection: collection.slug,
            version_data: updated,
            updated_by: (req as any).user?.id || null,
            change_summary: `Update ${collection.slug} record` // We could compute diffs here if needed
          });
        }
      } catch (versionErr) {
        this.logger.error(`Failed to create version snapshot for ${collection.slug}/${id}:`, versionErr);
      }

      // Notify parent about settings changes
      if (collection.slug === 'settings' && this.onSettingsUpdate) {
        this.onSettingsUpdate(id, data.value);
      }
      
      res.json(this.filterHiddenFields(collection, updated));
    } catch (err: any) {
      if (err.code === '23505' || err.code === 'ER_DUP_ENTRY' || err.message.includes('UNIQUE constraint failed')) {
        const detail = err.detail || err.message || '';
        const match = detail.match(/\((.*?)\)=\((.*?)\)/) || detail.match(/UNIQUE constraint failed: (.*)/);
        const field = match ? (match[1].split('.').pop() || 'field') : 'field';
        
        return res.status(409).json({ 
          error: `Duplicate entry found: A record with this ${field.replace(/_/g, ' ')} already exists.`
        });
      }
      this.logger.error(`Update error in ${collection.slug}:`, err);
      res.status(500).json({ error: err.message });
    }
  }

  async delete(collection: Collection, req: Request, res: Response) {
    try {
      const { id } = req.params;
      const pk = collection.primaryKey || 'id';
      const table = this.getVirtualTable(collection);
      
      const where: any = {};
      where[pk] = pk === 'id' ? parseInt(id) : id;

      const success = await this.db.delete(table, where);
      
      if (!success) {
        return res.status(404).json({ error: 'Not found' });
      }
      
      res.json({ success: true, id });
    } catch (err: any) {
      this.logger.error(`Delete error in ${collection.slug}:`, err);
      res.status(500).json({ error: err.message });
    }
  }

  async getGlobalActivity(collections: Collection[], req: Request, res: Response) {
    try {
      const allActivity: any[] = [];
      
      // We'll fetch the last 5 items from each collection
      await Promise.all(collections.map(async (c) => {
        try {
          const tableName = c.tableName || c.slug;
          const pk = c.primaryKey || 'id';
          
          const rows = await this.db.find(tableName, {
            limit: 5,
            orderBy: desc(sql`${sql.identifier(pk)}`)
          });
          
          rows.forEach((row: any) => {
            allActivity.push({
              id: `${c.slug}-${row[pk]}`,
              type: 'record',
              collection: c.slug,
              collectionName: c.name || c.slug,
              recordId: row[pk],
              title: row[c.admin?.useAsTitle || pk] || `Record #${row[pk]}`,
              timestamp: row.updatedAt || row.createdAt || row.updated_at || row.created_at || new Date(),
              user: row.email || row.username || 'System'
            });
          });
        } catch (e) {
          // Skip collections that might not exist yet or have errors
        }
      }));

      // Sort by timestamp descending
      allActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json(allActivity.slice(0, 20));
    } catch (err: any) {
      this.logger.error(`Global activity error:`, err);
      res.status(500).json({ error: err.message });
    }
  }

  async getSuggestions(collection: Collection, req: Request, res: Response) {
    try {
      const { field } = req.params;
      const { q } = req.query as any;
      const table = this.getVirtualTable(collection);

      if (!table[field]) {
        return res.status(400).json({ error: `Field ${field} does not exist in ${collection.slug}` });
      }

      // We'll perform a raw query or use drizzle to get distinct values
      // Note: for JSONB fields, we might need different logic if they are arrays
      
      const config = collection.fields.find(f => f.name === field);
      if (config?.type === 'json' || config?.admin?.component === 'TagField' || config?.admin?.component === 'Tags') {
        // Special logic for JSONB arrays: unnest them to get unique elements
        // This is Postgres specific
        let query = sql`SELECT DISTINCT jsonb_array_elements_text(${table[field]}) as value FROM ${table} WHERE ${table[field]} IS NOT NULL AND jsonb_typeof(${table[field]}) = 'array'`;
        
        if (q) {
          query = sql`${query} AND jsonb_array_elements_text(${table[field]}) ILIKE ${`%${q}%`}`;
        }
        
        query = sql`${query} LIMIT 50`;
        const result = await this.db.drizzle.execute(query);
        
        // If it's a relationship, we want both slug and name
        if (config.type === 'relationship' && config.relationTo) {
           const relatedCollection = config.relationTo;
           // We can't easily join and unnest in one go with dynamic tables without complex SQL
           // For now return labels if available
           return res.json(result.rows.map((r: any) => ({ label: r.value, value: r.value })));
        }

        return res.json(result.rows.map((r: any) => r.value));
      } else {
        // Build conditions using drizzle-orm helpers
        // For users collection, we are more lenient if searching for identifiers
        const isUserSearch = collection.slug === 'users' && (field === 'username' || field === 'email');
        const conditions: any[] = isUserSearch ? [] : [ isNotNull(table[field]) ];
        
        if (q) {
          if (isUserSearch) {
             // For users, if searching for username or email, check both and allow users without username
             const userConditions = [];
             if (table['username']) userConditions.push(ilike(table['username'], `%${q}%`));
             if (table['email']) userConditions.push(ilike(table['email'], `%${q}%`));
             
             if (userConditions.length > 1) {
               conditions.push(or(...userConditions));
             } else if (userConditions.length === 1) {
               conditions.push(userConditions[0]);
             }
          } else {
             conditions.push(ilike(table[field], `%${q}%`));
          }
        }

        const labelFieldName = (collection.admin?.useAsTitle && table[collection.admin.useAsTitle]) 
          ? collection.admin.useAsTitle 
          : field;
          
        // Build unique columns for GROUP BY
        const groupByColumns = new Set();
        groupByColumns.add(table[field]);
        if (table[labelFieldName]) groupByColumns.add(table[labelFieldName]);
        
        if (isUserSearch) {
          if (table['email']) groupByColumns.add(table['email']);
          if (table['username']) groupByColumns.add(table['username']);
        }

        const groupBy = Array.from(groupByColumns).filter(Boolean);

        const selectSchema: any = {
          value: isUserSearch 
            ? (table['username'] && table['email'] 
                ? sql`COALESCE(${table['username']}, ${table['email']})` 
                : (table['username'] || table['email'] || table[field]))
            : table[field],
          label: table[labelFieldName] || table[field]
        };

        const result = await this.db.drizzle
          .select(selectSchema)
          .from(table)
          .where(and(...conditions))
          .groupBy(...groupBy)
          .limit(50);
        
        return res.json(result.map((r: any) => ({ label: r.label, value: r.value })));
      }
    } catch (err: any) {
      this.logger.error(`Suggestions error in ${collection.slug} for ${req.params.field}:`, err);
      res.status(500).json({ error: err.message });
    }
  }
}
