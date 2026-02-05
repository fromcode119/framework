import { Collection, Field, FieldType } from '../types';
import { IDatabaseManager, sql } from '@fromcode/database';
import { Logger } from '../logging/logger';

export class SchemaManager {
  private logger = new Logger({ namespace: 'SchemaManager' });

  constructor(private db: IDatabaseManager) {}

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  async syncCollection(collection: Collection): Promise<void> {
    const tableName = collection.slug;
    this.logger.info(`Syncing schema for collection: ${tableName} (${this.db.dialect})`);

    try {
      const exists = await this.tableExists(tableName);

      if (!exists) {
        await this.createTable(collection);
      } else {
        await this.updateTable(collection);
      }
    } catch (error) {
      this.logger.error(`Failed to sync schema for ${tableName}: ${error}`);
      throw error;
    }
  }

  private async tableExists(tableName: string): Promise<boolean> {
    let query;
    if (this.db.dialect === 'sqlite') {
      query = sql`SELECT count(*) as total FROM sqlite_master WHERE type='table' AND name=${tableName}`;
    } else {
      query = sql`SELECT count(*) as total FROM information_schema.tables WHERE table_name = ${tableName}`;
    }

    const result: any = await this.db.execute(query);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    const total = parseInt(rows[0]?.total || rows[0]?.TOTAL || '0');
    return total > 0;
  }

  private async createTable(collection: Collection): Promise<void> {
    const tableName = collection.slug;
    const dialect = this.db.dialect;
    
    const columnDefs: any[] = [];

    // primary key
    if (dialect === 'postgres') {
      columnDefs.push(sql`id SERIAL PRIMARY KEY`);
    } else if (dialect === 'mysql') {
      columnDefs.push(sql`id INT AUTO_INCREMENT PRIMARY KEY`);
    } else {
      columnDefs.push(sql`id INTEGER PRIMARY KEY AUTOINCREMENT`);
    }

    // common timestamps
    if (dialect === 'postgres') {
        columnDefs.push(sql`created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
        columnDefs.push(sql`updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
    } else if (dialect === 'mysql') {
        columnDefs.push(sql`created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
        columnDefs.push(sql`updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    } else {
        columnDefs.push(sql`created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
        columnDefs.push(sql`updated_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }

    for (const field of collection.fields) {
      if (field.name === 'id') continue;
      columnDefs.push(this.fieldToSqlFragment(field));
    }

    const query = sql`CREATE TABLE ${sql.identifier(tableName)} (${sql.join(columnDefs, sql`, `)})`;
    
    this.logger.info(`Creating table ${tableName}...`);
    await this.db.execute(query);
  }

  private async updateTable(collection: Collection): Promise<void> {
    const tableName = collection.slug;
    const dialect = this.db.dialect;
    
    let query;
    if (dialect === 'sqlite') {
        query = sql`PRAGMA table_info(${sql.identifier(tableName)})`;
    } else {
        query = sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName}`;
    }

    const result: any = await this.db.execute(query);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    const existingColumnNames = rows.map((r: any) => (r.column_name || r.COLUMN_NAME || r.name).toLowerCase());

    for (const field of collection.fields) {
      if (field.name === 'id') continue;
      
      const dbName = this.toSnakeCase(field.name);
      if (!existingColumnNames.includes(dbName.toLowerCase())) {
        this.logger.info(`Adding column ${dbName} to ${tableName}...`);
        const columnDef = this.fieldToSqlFragment(field);
        await this.db.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
      }
    }
  }

  private fieldToSqlFragment(field: Field): any {
    const dialect = this.db.dialect;
    const dbName = this.toSnakeCase(field.name);
    let type = sql`TEXT`;
    
    switch (field.type) {
      case 'number':
        type = dialect === 'sqlite' ? sql`REAL` : sql`NUMERIC`;
        break;
      case 'boolean':
        type = dialect === 'mysql' ? sql`BOOLEAN` : (dialect === 'sqlite' ? sql`INTEGER` : sql`BOOLEAN`);
        break;
      case 'date':
        type = dialect === 'postgres' ? sql`TIMESTAMP WITH TIME ZONE` : (dialect === 'mysql' ? sql`DATETIME` : sql`TEXT`);
        break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
        type = dialect === 'postgres' ? sql`JSONB` : (dialect === 'mysql' ? sql`JSON` : sql`TEXT`);
        break;
      case 'textarea':
      case 'text':
      case 'select':
      default:
        type = sql`TEXT`;
    }

    const constraints: any[] = [];
    if (field.required) constraints.push(sql`NOT NULL`);
    if (field.unique) constraints.push(sql`UNIQUE`);
    if (field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        constraints.push(sql.raw(`DEFAULT '${field.defaultValue.replace(/'/g, "''")}'`));
      } else if (typeof field.defaultValue === 'boolean') {
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue ? (dialect === 'sqlite' ? 1 : 'true') : (dialect === 'sqlite' ? 0 : 'false')}`));
      } else if (typeof field.defaultValue === 'number') {
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue}`));
      }
    }

    return sql`${sql.identifier(dbName)} ${type} ${sql.join(constraints, sql` `)}`;
  }
}
