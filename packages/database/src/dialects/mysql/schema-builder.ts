import { sql } from 'drizzle-orm';
import { ISchemaCollection, ISchemaField } from '../../types';
import { NamingStrategy } from '../../naming-strategy';
import { ISchemaBuilderHost } from '../dialect-schema-builder.interfaces';

/**
 * MysqlSchemaBuilder - MySQL DDL generation and schema mutation.
 */
export class MysqlSchemaBuilder {
  private host: ISchemaBuilderHost;

  constructor(host: ISchemaBuilderHost) {
    this.host = host;
  }

  async createTable(collection: ISchemaCollection): Promise<void> {
    const tableName = collection.slug;
    const columnDefs: any[] = [];
    const fieldSnakeNames = collection.fields.map(f => NamingStrategy.toSnakeCase(f.name));

    if (!fieldSnakeNames.includes('id')) {
      columnDefs.push(sql`id INT AUTO_INCREMENT PRIMARY KEY`);
    }

    if (!fieldSnakeNames.includes('created_at')) {
      columnDefs.push(sql`created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    }

    if (!fieldSnakeNames.includes('updated_at')) {
      columnDefs.push(sql`updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
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
    const columnDef = this.fieldToSqlFragment(field);
    await this.host.execute(sql`ALTER TABLE ${sql.identifier(tableName)} ADD COLUMN ${columnDef}`);
    this.host.invalidateTableCache(tableName);
  }

  async ensureMigrationTable(tableName: string): Promise<void> {
    await this.host.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version INT NOT NULL,
        batch INT NOT NULL,
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
      case 'date': type = sql`DATETIME`; break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
        type = sql`JSON`;
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
