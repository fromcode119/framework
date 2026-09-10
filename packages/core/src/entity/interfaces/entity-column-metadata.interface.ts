import type { IEntityFieldConfig } from '@core/entity/interfaces/entity-field-config.interface';

export interface IEntityColumnMetadata {
  name: string;
  config: IEntityFieldConfig;
}
