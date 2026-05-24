import type { Collection, Field } from '../types';

export interface EntitySchemaColumnPlan {
  field: Field;
  columnName: string;
}

export interface EntitySchemaPlan {
  collection: Collection;
  tableName: string;
  fingerprint: string;
  exists: boolean;
  missingColumns: EntitySchemaColumnPlan[];
  unsupportedIndexes: string[];
}
