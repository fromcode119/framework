import { sql } from 'drizzle-orm';
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
      columnDefs.push(sql`id SERIAL PRIMARY KEY`);
    }

    if (!fieldSnakeNames.includes('created_at')) {
      columnDefs.push(sql`created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
    }

    if (!fieldSnakeNames.includes('updated_at')) {
      columnDefs.push(sql`updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
    }

    for (const field of fields) {
      columnDefs.push(this.fieldToSqlFragment(field));
    }

    const query = sql`CREATE TABLE ${sql.identifier(tableName)} (${sql.join(columnDefs, sql`, `)})`;
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
      const column = sql.identifier(NamingStrategy.toSnakeCase(field.name));
      await this.host.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${columnDef} DEFAULT ${backfill}`);
      await this.host.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ALTER COLUMN ${column} DROP DEFAULT`);
    } else {
      await this.host.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
    }
    this.host.invalidateTableCache(tableName);
  }

  /** The value existing rows receive when a required column arrives after them. */
  private static emptyValueFor(field: ISchemaField): any {
    switch (field.type) {
      case 'number': return sql.raw('0');
      case 'boolean': return sql.raw('false');
      case 'date': return sql.raw('CURRENT_TIMESTAMP');
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
        return sql.raw("'null'::jsonb");
      default: return sql.raw("''");
    }
  }

  async ensureMigrationTable(tableName: string): Promise<void> {
    await this.host.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
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
    let type = sql`TEXT`;

    switch (field.type) {
      case 'number': type = sql`NUMERIC`; break;
      case 'boolean': type = sql`BOOLEAN`; break;
      case 'date': type = sql`TIMESTAMP WITH TIME ZONE`; break;
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
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue ? 'true' : 'false'}`));
      } else if (typeof field.defaultValue === 'number') {
        constraints.push(sql.raw(`DEFAULT ${field.defaultValue}`));
      }
    }

    return sql`${sql.identifier(dbName)} ${type} ${sql.join(constraints, sql` `)}`;
  }
}
