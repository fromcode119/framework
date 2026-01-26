import { Collection, Field, FieldType } from '../types';
import { IDatabaseManager, infoTables, infoColumns, sql, eq, and, count } from '@fromcode/database';
import { Logger } from '../logging/logger';

export class SchemaManager {
  private logger = new Logger({ namespace: 'SchemaManager' });

  constructor(private db: IDatabaseManager) {}

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  async syncCollection(collection: Collection): Promise<void> {
    const tableName = collection.slug;
    this.logger.info(`Syncing schema for collection: ${tableName}`);

    try {
      await this.db.drizzle.transaction(async (tx: any) => {
        // Use Drizzle select on information_schema for type-safe check
        const result: any[] = await tx
          .select({ total: count() })
          .from(infoTables)
          .where(
            and(
              eq(infoTables.tableName, tableName),
              eq(infoTables.tableSchema, 'public')
            )
          );

        const exists = result[0]?.total > 0;

        if (!exists) {
          await this.createTable(collection, tx);
        } else {
          await this.updateTable(collection, tx);
        }
      });
    } catch (error) {
      this.logger.error(`Failed to sync schema for ${tableName}: ${error}`);
      throw error;
    }
  }

  private async createTable(collection: Collection, tx?: any): Promise<void> {
    const executor = tx || this.db.drizzle;
    const tableName = collection.slug;
    
    const columnDefs: any[] = [
      sql`id SERIAL PRIMARY KEY`,
      sql`created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
      sql`updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
    ];

    for (const field of collection.fields) {
      if (field.name === 'id') continue;
      columnDefs.push(this.fieldToSqlFragment(field));
    }

    const query = sql`CREATE TABLE ${sql.identifier(tableName)} (${sql.join(columnDefs, sql`, `)})`;
    
    this.logger.info(`Creating table ${tableName}...`);
    await executor.execute(query);
  }

  private async updateTable(collection: Collection, tx?: any): Promise<void> {
    const executor = tx || this.db.drizzle;
    const tableName = collection.slug;
    
    // Use Drizzle select on information_schema.columns
    const result = await executor
      .select({ columnName: infoColumns.columnName })
      .from(infoColumns)
      .where(
        and(
          eq(infoColumns.tableName, tableName),
          eq(infoColumns.tableSchema, 'public')
        )
      );
    
    const existingColumnNames = result.map((c: any) => c.columnName);

    for (const field of collection.fields) {
      if (field.name === 'id') continue;
      
      const dbName = this.toSnakeCase(field.name);
      if (!existingColumnNames.includes(dbName)) {
        this.logger.info(`Adding column ${dbName} to ${tableName}...`);
        const columnDef = this.fieldToSqlFragment(field);
        await executor.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
      }
    }
  }

  private fieldToSqlFragment(field: Field): any {
    let type = sql`TEXT`;
    const dbName = this.toSnakeCase(field.name);
    
    switch (field.type) {
      case 'number':
        type = sql`NUMERIC`;
        break;
      case 'boolean':
        type = sql`BOOLEAN`;
        break;
      case 'date':
        type = sql`TIMESTAMP WITH TIME ZONE`;
        break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
        type = sql`JSONB`;
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
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue}`));
      } else if (typeof field.defaultValue === 'number') {
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue}`));
      }
    }

    return sql`${sql.identifier(dbName)} ${type} ${sql.join(constraints, sql` `)}`;
  }
}
