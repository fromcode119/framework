import { sql } from 'drizzle-orm';
import { ISchemaCollection, ISchemaField } from '../types';
import { NamingStrategy } from '../naming-strategy';
import { ISchemaBuilderHost } from './dialect-schema-builder.interfaces';

/**
 * SqliteSchemaBuilder - SQLite DDL generation and schema mutation.
 *
 * Owns the column-definition fragment builder plus CREATE/ALTER/migration-table
 * operations, delegating actual query execution and cache invalidation back to
 * the owning manager via ISchemaBuilderHost.
 */
export class SqliteSchemaBuilder {
  private host: ISchemaBuilderHost;

  constructor(host: ISchemaBuilderHost) {
    this.host = host;
  }

  async createTable(collection: ISchemaCollection): Promise<void> {
    const tableName = collection.slug;
    const columnDefs: any[] = [];
    const fieldSnakeNames = collection.fields.map(f => NamingStrategy.toSnakeCase(f.name));

    if (!fieldSnakeNames.includes('id')) {
      columnDefs.push(sql`id INTEGER PRIMARY KEY AUTOINCREMENT`);
    }
    if (!fieldSnakeNames.includes('created_at')) {
      columnDefs.push(sql`created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }
    if (!fieldSnakeNames.includes('updated_at')) {
      columnDefs.push(sql`updated_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }

    for (const field of collection.fields) {
      if (field.name === 'id' && !fieldSnakeNames.includes('id')) continue;
      columnDefs.push(this.fieldToSqlFragment(field));
    }

    const query = sql`CREATE TABLE ${sql.identifier(tableName)} (${sql.join(columnDefs, sql`, `)})`;
    await this.host.execute(query);
    this.host.invalidateTableCache(tableName);
  }

  async addColumn(tableName: string, field: ISchemaField): Promise<void> {
    const columnDef = this.fieldToSqlFragment(field, { includeUnique: false });
    await this.host.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
    if (field.unique) {
      await this.createUniqueIndex(tableName, NamingStrategy.toSnakeCase(field.name));
    }
    this.host.invalidateTableCache(tableName);
  }

  private async createUniqueIndex(tableName: string, columnName: string): Promise<void> {
    const indexName = `${tableName}_${columnName}_unique_idx`
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_');

    await this.host.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier(indexName)} ON ${sql.identifier(tableName)} (${sql.identifier(columnName)})`
    );
  }

  async ensureMigrationTable(tableName: string): Promise<void> {
    await this.host.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        version INTEGER NOT NULL,
        batch INTEGER NOT NULL,
        executed_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private fieldToSqlFragment(field: ISchemaField, options: { includeUnique?: boolean } = {}): any {
    const dbName = NamingStrategy.toSnakeCase(field.name);
    const includeUnique = options.includeUnique !== false;
    let type = sql`TEXT`;

    switch (field.type) {
      case 'number': type = sql`REAL`; break;
      case 'boolean': type = sql`INTEGER`; break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
      case 'textarea':
      case 'text':
      case 'select':
      case 'date':
      default:
        type = sql`TEXT`;
    }

    const constraints: any[] = [];
    if (field.required) constraints.push(sql`NOT NULL`);
    if (includeUnique && field.unique) constraints.push(sql`UNIQUE`);

    if (field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        constraints.push(sql.raw(`DEFAULT '${field.defaultValue.replace(/'/g, "''")}'`));
      } else if (typeof field.defaultValue === 'boolean') {
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue ? 1 : 0}`));
      } else if (typeof field.defaultValue === 'number') {
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue}`));
      }
    }

    return sql`${sql.identifier(dbName)} ${type} ${sql.join(constraints, sql` `)}`;
  }
}
