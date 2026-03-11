import { IDatabaseManager, sql } from '@fromcode119/database';
import { Collection } from '@fromcode119/core';

export class ActivityService {
  constructor(private db: IDatabaseManager) {}

  async getGlobalActivity(collections: Collection[]) {
    const allActivity: any[] = [];
    
    // We'll fetch the last 5 items from each collection
    await Promise.all(collections.map(async (c) => {
      try {
        const tableName = c.tableName || c.slug;
        const pk = c.primaryKey || 'id';
        
        const rows = await this.db.find(tableName, {
          limit: 5,
          orderBy: this.db.desc(sql`${sql.identifier(pk)}`)
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
            user: row.email || row.username || 'system'
          });
        });
      } catch (e) {
        // Skip collections that might not exist yet or have errors
      }
    }));

    // Sort by timestamp descending
    allActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return allActivity.slice(0, 20);
  }
}