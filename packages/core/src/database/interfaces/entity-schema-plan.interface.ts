import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IEntitySchemaColumnPlan } from '@core/database/interfaces/entity-schema-column-plan.interface';

export interface IEntitySchemaPlan {
  collection: ICollection;
  tableName: string;
  fingerprint: string;
  exists: boolean;
  missingColumns: IEntitySchemaColumnPlan[];
  unsupportedIndexes: string[];
}
