import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IEntitySchemaColumnPlan } from '@core/database/interfaces/entity-schema-column-plan.interface';

export interface IEntitySchemaPlan {
  collection: ICollection;
  tableName: string;
  fingerprint: string;
  exists: boolean;
  missingColumns: IEntitySchemaColumnPlan[];
  /**
   * Columns that EXIST and are declared `unique`. Whether a unique already covers them is a question
   * for the database, not for this pure planner — the manager asks, and adds only what is missing.
   */
  declaredUniques: string[];

  /**
   * Existing columns whose field is NOT declared required — the database may still hold a NOT NULL
   * from when the column was created, which no longer matches what the admin presents.
   */
  declaredOptionals: string[];
  unsupportedIndexes: string[];
}
