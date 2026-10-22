import type { IIndexCondition } from '@fromcode119/database';

export interface IDeclaredIndex {
  /** Never longer than the engine's identifier limit — see EntitySchemaPlanService. */
  name: string;
  /** snake_case column names, in declared order. */
  columns: string[];
  unique: boolean;
  /** Present for a PARTIAL index: the rows it covers. snake_case columns. */
  where?: IIndexCondition[];
}
