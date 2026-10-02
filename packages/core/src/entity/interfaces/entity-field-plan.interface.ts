import type { IEntityFieldConfig } from '@core/entity/interfaces/entity-field-config.interface';

/** One field of an entity mapping, with its source paths split and its transforms named once. */
export interface IEntityFieldPlan {
  key: string;
  config: IEntityFieldConfig;
  sources: string[][];
  transforms: string[];
}
