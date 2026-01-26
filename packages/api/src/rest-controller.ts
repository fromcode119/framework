import { Request, Response, NextFunction } from 'express';
import { Collection, Logger } from '@fromcode/core';
import { AuthManager } from '@fromcode/auth';
import { 
  IDatabaseManager, 
  sql, 
  count, 
  and, 
  or,
  eq, 
  ilike,
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

  constructor(private db: IDatabaseManager, private auth?: AuthManager) {}

  /**
   * Generates or retrieves a Drizzle table object for a given collection definition.
   */
  private getVirtualTable(collection: Collection) {
    if (this.virtualTables.has(collection.slug)) {
      return this.virtualTables.get(collection.slug);
    }

    const table = createDynamicTable({
      slug: collection.slug,
      fields: collection.fields.map(f => ({ name: f.name, type: f.type }))
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
      
      let orderBy: any[] = [desc(table.id)]; // Default sort
      if (sort) {
        const isDesc = sort.startsWith('-');
        const fieldName = isDesc ? sort.substring(1) : sort;
        if (table[fieldName]) {
          orderBy = [isDesc ? desc(table[fieldName]) : asc(table[fieldName])];
        }
      }
      
      const limitVal = Math.min(parseInt(limit as string) || 10, 100);
      const offsetVal = parseInt(offset as string) || 0;

      const rowsResult = await this.db.drizzle
        .select()
        .from(table)
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limitVal)
        .offset(offsetVal);

      const totalResult = await this.db.drizzle
        .select({ total: count() })
        .from(table)
        .where(whereClause);
      
      const total = Number(totalResult[0]?.total || 0);

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
      const table = this.getVirtualTable(collection);
      
      const result = await this.db.drizzle
        .select()
        .from(table)
        .where(eq(table.id, parseInt(id)))
        .limit(1);
      
      if (result.length === 0) {
        return res.status(404).json({ error: 'Not found' });
      }
      
      res.json(this.filterHiddenFields(collection, result[0]));
    } catch (err: any) {
      this.logger.error(`FindOne error in ${collection.slug}:`, err);
      res.status(500).json({ error: err.message });
    }
  }

  async create(collection: Collection, req: Request, res: Response) {
    try {
      const data = req.body;
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
          
          insertData[key] = value;
        }
      }

      const [newItem] = await this.db.drizzle
        .insert(table)
        .values(insertData)
        .returning();
      
      res.status(201).json(this.filterHiddenFields(collection, newItem));
    } catch (err: any) {
      if (err.code === '23505') { // Unique constraint violation in Postgres
        const detail = err.detail || '';
        const match = detail.match(/\((.*?)\)=\((.*?)\)/);
        const field = match ? match[1] : 'field';
        return res.status(409).json({ 
          error: `Duplicate entry found: A record with this ${field} already exists.`
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
      const table = this.getVirtualTable(collection);
      
      // Basic validation
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
      const excludedFields = ['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'];
      
      for (const key of Object.keys(data)) {
        if (table[key] && !excludedFields.includes(key)) {
          let value = data[key];
          
          // Special handling for passwords in Users collection
          if (collection.slug === 'users' && key === 'password' && this.auth && value) {
            value = await this.auth.hashPassword(value);
          }

          updateData[key] = value;
        }
      }
      
      // Explicitly set updatedAt using database time if the column exists
      if (table.updatedAt) {
        updateData.updatedAt = sql`now()`;
      }

      const [updated] = await this.db.drizzle
        .update(table)
        .set(updateData)
        .where(eq(table.id, parseInt(id)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Not found' });
      }
      
      res.json(this.filterHiddenFields(collection, updated));
    } catch (err: any) {
      if (err.code === '23505') { // Unique constraint violation in Postgres
        const detail = err.detail || '';
        const match = detail.match(/\((.*?)\)=\((.*?)\)/);
        const field = match ? match[1] : 'field';
        return res.status(409).json({ 
          error: `Duplicate entry found: A record with this ${field} already exists.`
        });
      }
      this.logger.error(`Update error in ${collection.slug}:`, err);
      res.status(500).json({ error: err.message });
    }
  }

  async delete(collection: Collection, req: Request, res: Response) {
    try {
      const { id } = req.params;
      const table = this.getVirtualTable(collection);
      
      const [deleted] = await this.db.drizzle
        .delete(table)
        .where(eq(table.id, parseInt(id)))
        .returning({ id: table.id });
      
      if (!deleted) {
        return res.status(404).json({ error: 'Not found' });
      }
      
      res.json({ success: true, id: deleted.id });
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
          const table = this.getVirtualTable(c);
          const rows = await this.db.drizzle
            .select()
            .from(table)
            .orderBy(desc(table.id))
            .limit(5);
          
          rows.forEach((row: any) => {
            allActivity.push({
              id: `${c.slug}-${row.id}`,
              type: 'record',
              collection: c.slug,
              collectionName: c.name || c.slug,
              recordId: row.id,
              title: row[c.admin?.useAsTitle || 'id'] || `Record #${row.id}`,
              timestamp: row.updatedAt || row.createdAt || new Date(),
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
      const table = this.getVirtualTable(collection);

      if (!table[field]) {
        return res.status(400).json({ error: `Field ${field} does not exist in ${collection.slug}` });
      }

      // We'll perform a raw query or use drizzle to get distinct values
      // Note: for JSONB fields, we might need different logic if they are arrays
      
      const config = collection.fields.find(f => f.name === field);
      if (config?.type === 'json' || config?.admin?.component === 'Tags') {
        // Special logic for JSONB arrays: unnest them to get unique elements
        // This is Postgres specific
        const query = sql`SELECT DISTINCT jsonb_array_elements_text(${table[field]}) as value FROM ${table} WHERE ${table[field]} IS NOT NULL AND jsonb_typeof(${table[field]}) = 'array' LIMIT 50`;
        const result = await this.db.drizzle.execute(query);
        return res.json(result.rows.map((r: any) => r.value));
      } else {
        const result = await this.db.drizzle
          .select({ value: table[field] })
          .from(table)
          .where(sql`${table[field]} IS NOT NULL`)
          .groupBy(table[field])
          .limit(50);
        
        return res.json(result.map(r => r.value));
      }
    } catch (err: any) {
      this.logger.error(`Suggestions error in ${collection.slug} for ${req.params.field}:`, err);
      res.status(500).json({ error: err.message });
    }
  }
}
