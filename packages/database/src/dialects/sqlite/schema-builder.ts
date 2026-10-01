import { RowTimestampColumn } from '@database/row-timestamp-column';
import { Sql } from '@database/sql/sql';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import { NamingStrategy } from '@database/naming-strategy';
import { SchemaKeyField } from '@database/schema-key-field';
import { ISchemaBuilderHost } from '@database/dialects/interfaces/schema-builder-host.interface';

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
    const fields = SchemaKeyField.withoutDeclaredKey(collection.fields);
    const fieldSnakeNames = fields.map(f => NamingStrategy.toSnakeCase(f.name));

    if (!fieldSnakeNames.includes('id')) {
      columnDefs.push(Sql.query`id INTEGER PRIMARY KEY AUTOINCREMENT`);
    }
    if (!fieldSnakeNames.includes('created_at')) {
      columnDefs.push(Sql.query`created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }
    if (!fieldSnakeNames.includes('updated_at')) {
      columnDefs.push(Sql.query`updated_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }

    for (const field of fields) {
      columnDefs.push(this.fieldToSqlFragment(field));
    }

    const query = Sql.query`CREATE TABLE ${Sql.identifier(tableName)} (${Sql.join(columnDefs, Sql.query`, `)})`;
    await this.host.execute(query);
    this.host.invalidateTableCache(tableName);
  }

  async addColumn(tableName: string, field: ISchemaField): Promise<void> {
    const columnDef = this.fieldToSqlFragment(field, { includeUnique: false });
    // SQLite likewise refuses a NOT NULL column without a default on a populated table; SQLite cannot
    // drop a default afterwards, so the type's empty value stays as the column default here.
    if (field.required && field.defaultValue === undefined) {
      const backfill = field.type === 'number' || field.type === 'boolean' ? Sql.raw('0') : field.type === 'date' ? Sql.raw('CURRENT_TIMESTAMP') : Sql.raw("''");
      await this.host.execute(Sql.query`ALTER TABLE ${Sql.identifier(tableName)} ADD COLUMN ${columnDef} DEFAULT ${backfill}`);
    } else {
      await this.host.execute(Sql.query`ALTER TABLE ${Sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
    }
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
      Sql.query`CREATE UNIQUE INDEX IF NOT EXISTS ${Sql.identifier(indexName)} ON ${Sql.identifier(tableName)} (${Sql.identifier(columnName)})`
    );
  }

  async ensureMigrationTable(tableName: string): Promise<void> {
    await this.host.execute(Sql.query`
      CREATE TABLE IF NOT EXISTS ${Sql.identifier(tableName)} (
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
    let type = Sql.query`TEXT`;

    switch (field.type) {
      case 'number': type = Sql.query`REAL`; break;
      case 'boolean': type = Sql.query`INTEGER`; break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
      case 'textarea':
      case 'text':
      case 'select':
      case 'date':
      case 'datetime':
      default:
        type = Sql.query`TEXT`;
    }

    const constraints: any[] = [];
    if (field.required) constraints.push(Sql.query`NOT NULL`);
    if (includeUnique && field.unique) constraints.push(Sql.query`UNIQUE`);

    if (field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        constraints.push(Sql.raw(`DEFAULT '${field.defaultValue.replace(/'/g, "''")}'`));
      } else if (typeof field.defaultValue === 'boolean') {
        constraints.push(Sql.raw(`DEFAULT ${field.defaultValue ? 1 : 0}`));
      } else if (typeof field.defaultValue === 'number') {
        constraints.push(Sql.raw(`DEFAULT ${field.defaultValue}`));
      }
    }

    // SQLite refuses a non-constant default on ADD COLUMN, so only a CREATE TABLE gets it here.
    if (RowTimestampColumn.needsDefault(dbName, String(field.type), field.defaultValue) && includeUnique) {
      constraints.push(Sql.query`DEFAULT CURRENT_TIMESTAMP`);
    }

    return Sql.query`${Sql.identifier(dbName)} ${type} ${Sql.join(constraints, Sql.query` `)}`;
  }
}
