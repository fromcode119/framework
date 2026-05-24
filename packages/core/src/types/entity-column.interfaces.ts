import type { EntityFieldConfig } from './entity-field-config.interfaces';
import type { EntityColumnOptions } from './entity-column.types';

export interface EntityColumnMetadata {
  name: string;
  config: EntityFieldConfig;
}
