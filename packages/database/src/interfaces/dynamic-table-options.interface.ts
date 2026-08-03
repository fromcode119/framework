import type { IDynamicField } from '@database/interfaces/dynamic-field.interface';

export interface IDynamicTableOptions {
  slug: string;
  fields: IDynamicField[];
  timestamps?: boolean;
  workflow?: boolean;
  primaryKey?: string;
}
