import type { IEntityFieldConfig } from '@core/interfaces/entity-field-config.interface';

/** Per-field configuration for an entity, keyed by field name. */
export interface IEntityFieldsConfig {
  [fieldName: string]: IEntityFieldConfig;
}
