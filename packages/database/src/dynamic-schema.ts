import { 
  pgTable, 
  serial, 
  text, 
  numeric, 
  boolean, 
  timestamp, 
  jsonb 
} from 'drizzle-orm/pg-core';

export interface DynamicField {
  name: string;
  type: string;
}

export interface DynamicTableOptions {
  slug: string;
  fields: DynamicField[];
  timestamps?: boolean;
  workflow?: boolean;
  primaryKey?: string;
}

/**
 * Creates a Drizzle PG table object dynamically from a field list.
 */
export function createDynamicTable(options: DynamicTableOptions) {
  const { slug, fields, timestamps = true, workflow = false, primaryKey = 'id' } = options;
  
  // Helper to convert camelCase to snake_case
  const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

  const columns: any = {};
  
  // If primaryKey is 'id' and not in fields, add it as serial
  if (primaryKey === 'id' && !fields.find(f => f.name === 'id')) {
    columns.id = serial('id').primaryKey();
  }

  fields.forEach(field => {
    const dbName = toSnakeCase(field.name);
    let column: any;

    switch (field.type) {
      case 'number':
        column = numeric(dbName);
        break;
      case 'boolean':
        column = boolean(dbName);
        break;
      case 'date':
        column = timestamp(dbName, { withTimezone: true });
        break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
        column = jsonb(dbName);
        break;
      default:
        column = text(dbName);
    }

    if (field.name === primaryKey) {
      column = column.primaryKey();
    }

    columns[field.name] = column;
  });

  if (timestamps) {
    if (!columns.createdAt) columns.createdAt = timestamp('created_at', { withTimezone: true }).defaultNow();
    if (!columns.updatedAt) columns.updatedAt = timestamp('updated_at', { withTimezone: true }).defaultNow();
  }

  if (workflow) {
    if (!columns.status) columns.status = text('status').notNull().default('draft');
  }

  return pgTable(slug, columns);
}
