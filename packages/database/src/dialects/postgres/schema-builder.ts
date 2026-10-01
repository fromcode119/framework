import { RowTimestampColumn } from '@database/row-timestamp-column';
import { Sql } from '@database/sql/sql';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import { NamingStrategy } from '@database/naming-strategy';
import { SchemaKeyField } from '@database/schema-key-field';
import { ISchemaBuilderHost } from '@database/dialects/interfaces/schema-builder-host.interface';

/**
 * PostgresSchemaBuilder - Postgres DDL generation and schema mutation.
 */
export class PostgresSchemaBuilder {
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
      columnDefs.push(Sql.query`id SERIAL PRIMARY KEY`);
    }

    if (!fieldSnakeNames.includes('created_at')) {
      columnDefs.push(Sql.query`created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
    }

    if (!fieldSnakeNames.includes('updated_at')) {
      columnDefs.push(Sql.query`updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
    }

    for (const field of fields) {
      columnDefs.push(this.fieldToSqlFragment(field));
    }

    const query = Sql.query`CREATE TABLE ${Sql.identifier(tableName)} (${Sql.join(columnDefs, Sql.query`, `)})`;
    await this.host.execute(query);
    this.host.invalidateTableCache(tableName);
  }

  async addColumn(tableName: string, field: ISchemaField): Promise<void> {
    const columnDef = this.fieldToSqlFragment(field);
    // A REQUIRED column with no declared default cannot be added to a table that already has rows:
    // Postgres refuses `ADD COLUMN … NOT NULL` outright. The rows that exist get the type's empty
    // value ('' / 0 / false / now), and the default is dropped again immediately so every NEW row
    // still has to supply the field — the schema's `required` keeps its meaning.
    if (field.required && field.defaultValue === undefined) {
      const backfill = PostgresSchemaBuilder.emptyValueFor(field);
      const column = Sql.identifier(NamingStrategy.toSnakeCase(field.name));
      await this.host.execute(Sql.query`ALTER TABLE ${Sql.identifier(tableName)} ADD COLUMN ${columnDef} DEFAULT ${backfill}`);
      await this.host.execute(Sql.query`ALTER TABLE ${Sql.identifier(tableName)} ALTER COLUMN ${column} DROP DEFAULT`);
    } else {
      await this.host.execute(Sql.query`ALTER TABLE ${Sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
    }
    this.host.invalidateTableCache(tableName);
  }

  /** The value existing rows receive when a required column arrives after them. */
  private static emptyValueFor(field: ISchemaField): any {
    switch (field.type) {
      case 'number': return Sql.raw('0');
      case 'boolean': return Sql.raw('false');
      case 'date':
      case 'datetime': return Sql.raw('CURRENT_TIMESTAMP');
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
        return Sql.raw("'null'::jsonb");
      default: return Sql.raw("''");
    }
  }

  async ensureMigrationTable(tableName: string): Promise<void> {
    await this.host.execute(Sql.query`
      CREATE TABLE IF NOT EXISTS ${Sql.identifier(tableName)} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version INTEGER NOT NULL,
        batch INTEGER NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private fieldToSqlFragment(field: ISchemaField): any {
    const dbName = NamingStrategy.toSnakeCase(field.name);
    let type = Sql.query`TEXT`;

    switch (field.type) {
      case 'number': type = Sql.query`NUMERIC`; break;
      case 'boolean': type = Sql.query`BOOLEAN`; break;
      // `datetime` is the admin's date-AND-time field; it fell through to TEXT, so its values sorted and
      // compared as strings. Both are points in time.
      case 'date':
      case 'datetime': type = Sql.query`TIMESTAMP WITH TIME ZONE`; break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
        type = Sql.query`JSONB`;
        break;
      case 'textarea':
      case 'text':
      case 'select':
      default:
        type = Sql.query`TEXT`;
    }

    const constraints: any[] = [];
    if (field.required) constraints.push(Sql.query`NOT NULL`);
    if (field.unique) constraints.push(Sql.query`UNIQUE`);

    if (field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        constraints.push(Sql.raw(`DEFAULT '${field.defaultValue.replace(/'/g, "''")}'`));
      } else if (typeof field.defaultValue === 'boolean') {
        constraints.push(Sql.raw(`DEFAULT ${field.defaultValue ? 'true' : 'false'}`));
      } else if (typeof field.defaultValue === 'number') {
        constraints.push(Sql.raw(`DEFAULT ${field.defaultValue}`));
      }
    }

    if (RowTimestampColumn.needsDefault(dbName, String(field.type), field.defaultValue)) {
      constraints.push(Sql.query`DEFAULT CURRENT_TIMESTAMP`);
    }

    return Sql.query`${Sql.identifier(dbName)} ${type} ${Sql.join(constraints, Sql.query` `)}`;
  }
}
