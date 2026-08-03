import { FieldType } from '@core/enums/field-type.enum';
import type { IField } from '@core/interfaces/field.interface';
import { EntityFieldTransform } from '@core/enums/entity-field-transform.enum';

export interface IEntityFieldConfig {
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
  options?: IField['options'];
  relationTo?: IField['relationTo'];
  hasMany?: boolean;
  admin?: IField['admin'];
}
