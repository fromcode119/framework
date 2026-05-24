import type { FieldType } from './enums.enums';
import type { Field } from './schema.interfaces';
import type { EntityFieldTransform, EntityFieldsConfig } from './entity-field-config.types';

export interface EntityEnumOptions {
  default?: string;
  values: Record<string, string[]>;
}

export interface EntityFieldConfig {
  type: FieldType | 'string' | 'object' | 'enum' | 'raw' | 'relationId' | 'isoDate' | 'isoDateOrNow' | string;
  label?: string;
  from?: string[];
  fallbackTo?: string;
  default?: unknown;
  required?: boolean;
  optional?: boolean;
  unique?: boolean;
  transform?: EntityFieldTransform | EntityFieldTransform[] | string | string[];
  values?: Record<string, string[]>;
  options?: Field['options'];
  relationTo?: Field['relationTo'];
  hasMany?: boolean;
  admin?: Field['admin'];
}


