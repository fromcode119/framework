import { FieldType } from '@core/enums/field-type.enum';
import type { IField } from '@core/interfaces/field.interface';
import { EntityFieldTransform } from '@core/enums/entity-field-transform.enum';

export interface IEntityFieldConfig {
  /**
   * A `FieldType` value, or one of the mapper's own shorthands — `string`, `object`, `enum`, `raw`,
   * `relationId`, `isoDate`, `isoDateOrNow`.
   *
   * Plainly `string`: the union that used to be written here ended in `| string`, which absorbed
   * every literal before it, so it constrained nothing and only read as though it did. The list
   * belongs in this sentence, where it is honest about being documentation.
   */
  type: FieldType | string;
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
