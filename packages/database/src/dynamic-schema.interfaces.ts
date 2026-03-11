/** Type definitions for DynamicSchema */

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
