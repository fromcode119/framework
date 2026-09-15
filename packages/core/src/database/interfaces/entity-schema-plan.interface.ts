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

  /**
   * Columns the table HAS that nothing declares — the other half of the diff, which was computed and
   * thrown away for years.
   *
   * Every plugin update that renamed or removed a field left one of these behind: 58 of them on one
   * production database, catalogued by hand a month before this and still there. NEVER acted on
   * automatically; dropping a column is irreversible and one of those 58 held live data.
   */
  undeclaredColumns: string[];
  unsupportedIndexes: string[];
}
