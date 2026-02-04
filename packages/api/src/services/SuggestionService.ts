import { IDatabaseManager, sql, and, or, ilike, isNotNull } from '@fromcode/database';
import { Collection, Logger } from '@fromcode/core';

export class SuggestionService {
  private logger = new Logger({ namespace: 'Suggestions' });

  constructor(private db: IDatabaseManager) {}

  async getSuggestions(collection: Collection, field: string, q?: string, table?: any) {
    try {
      const config = collection.fields.find(f => f.name === field);
      
      // Safety: If field doesn't exist, don't crash the suggestions API, just return empty
      if (!config && field !== 'id' && field !== 'slug' && field !== 'username') {
        this.logger.warn(`Suggestions requested for non-existent field "${field}" in collection "${collection.slug}"`);
        return [];
      }

      const actualTable = table || (this.db as any).createDynamicTable({
        slug: collection.tableName || collection.slug,
        fields: collection.fields.map((f: any) => ({ name: f.name, type: f.type })),
        primaryKey: collection.primaryKey || 'id',
        timestamps: collection.timestamps !== false
      });

      if (config && (config.type === 'json' || config.admin?.component === 'TagField' || config.admin?.component === 'Tags')) {
        let query: any = sql`SELECT DISTINCT jsonb_array_elements_text(${actualTable[field]}) as value FROM ${actualTable} WHERE ${actualTable[field]} IS NOT NULL AND jsonb_typeof(${actualTable[field]}) = 'array'`;
        
        if (q) {
          query = sql`${query} AND jsonb_array_elements_text(${actualTable[field]}) ILIKE ${`%${q}%`}`;
        }
        
        query = sql`${query} LIMIT 50`;
        const result = await this.db.drizzle.execute(query);
        
        return result.rows.map((r: any) => ({ label: r.value, value: r.value }));
      } else if (actualTable[field]) {
        const isUserSearch = collection.slug === 'users' && (field === 'username' || field === 'email');
        const conditions: any[] = [];
        
        if (!isUserSearch) {
            conditions.push(isNotNull(actualTable[field]));
        }
        
        if (q) {
          if (isUserSearch) {
             const userConditions: any[] = [];
             if (actualTable['username']) userConditions.push(ilike(actualTable['username'], `%${q}%`));
             if (actualTable['email']) userConditions.push(ilike(actualTable['email'], `%${q}%`));
             
             if (userConditions.length > 0) {
                conditions.push(or(...userConditions));
             }
          } else {
             conditions.push(ilike(actualTable[field], `%${q}%`));
          }
        }

        // Simpler implementation for now as we are refactoring
        const labelFieldName = (collection.admin?.useAsTitle && actualTable[collection.admin.useAsTitle]) 
          ? collection.admin.useAsTitle 
          : field;

        const result = await this.db.drizzle
          .select({
            value: actualTable[field],
            label: actualTable[labelFieldName] || actualTable[field]
          })
          .from(actualTable)
          .where(and(...conditions))
          .groupBy(actualTable[field], actualTable[labelFieldName])
          .limit(50);
        
        return result.map((r: any) => ({ label: r.label, value: r.value }));
      } else {
        // Field not in table and no special handling
        this.logger.warn(`Suggestions field "${field}" not found in table for collection "${collection.slug}"`);
        return [];
      }
    } catch (err: any) {
      this.logger.error(`Suggestions error in ${collection.slug} for ${field}:`, err);
      throw err;
    }
  }
}
