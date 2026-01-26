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
}

/**
 * Creates a Drizzle PG table object dynamically from a field list.
 */
export function createDynamicTable(options: DynamicTableOptions) {
  const { slug, fields, timestamps = true } = options;
  
  // Helper to convert camelCase to snake_case
  const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

  const columns: any = {
    id: serial('id').primaryKey(),
  };

  fields.forEach(field => {
    if (field.name === 'id') return;
    
    const dbName = toSnakeCase(field.name);

    switch (field.type) {
      case 'number':
        columns[field.name] = numeric(dbName);
        break;
      case 'boolean':
        columns[field.name] = boolean(dbName);
        break;
      case 'date':
        columns[field.name] = timestamp(dbName, { withTimezone: true });
        break;
      case 'json':
      case 'relationship':
      case 'upload':
      case 'richText':
        columns[field.name] = jsonb(dbName);
        break;
      default:
        columns[field.name] = text(dbName);
    }
  });

  if (timestamps) {
    if (!columns.createdAt) columns.createdAt = timestamp('created_at', { withTimezone: true }).defaultNow();
    if (!columns.updatedAt) columns.updatedAt = timestamp('updated_at', { withTimezone: true }).defaultNow();
  }

  return pgTable(slug, columns);
}
