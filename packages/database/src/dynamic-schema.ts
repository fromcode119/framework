import { SqlColumns } from '@database/sql/sql-columns';
import { SqlTable } from '@database/sql/sql-table';

import type { IDynamicTableOptions } from '@database/interfaces/dynamic-table-options.interface';

export class DynamicSchema {
  static createDynamicTable(options: IDynamicTableOptions) {
      const { slug, fields, timestamps = true, workflow = false, primaryKey = 'id' } = options;

      // Helper to convert camelCase to snake_case
      const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

      const columns: any = {};

      // If primaryKey is 'id' and not in fields, add it as serial
      if (primaryKey === 'id' && !fields.find(f => f.name === 'id')) {
        columns.id = SqlColumns.serial('id').primaryKey();
      }

      fields.forEach(field => {
        const dbName = toSnakeCase(field.name);
        let column: any;

        switch (field.type) {
          case 'number':
            column = SqlColumns.numeric(dbName);
            break;
          case 'boolean':
            column = SqlColumns.boolean(dbName);
            break;
          case 'date':
            column = SqlColumns.timestamp(dbName, { withTimezone: true });
            break;
          case 'json':
          case 'relationship':
          case 'upload':
          case 'richText':
            column = SqlColumns.jsonb(dbName);
            break;
          default:
            column = SqlColumns.text(dbName);
        }

        if (field.name === primaryKey) {
          column = column.primaryKey();
        }

        columns[field.name] = column;
      });

      if (timestamps) {
        if (!columns.createdAt) columns.createdAt = SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow();
        if (!columns.updatedAt) columns.updatedAt = SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow();
      }

      if (workflow) {
        if (!columns.status) columns.status = SqlColumns.text('status').notNull().default('draft');
      }

      return SqlTable.define(slug, columns);

  }
}