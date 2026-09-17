/**
 * One table in an import plan, as the operator is shown it before deciding.
 *
 * A data shape, so an interface in its own file rather than a `type` beside the component — the same
 * placement every other contract in this tree uses.
 */
export interface IImportPlanTable {
  name: string;
  rows: number;
  /**
   * A `TenantImportIdMode` VALUE, as the plan sends it.
   *
   * The platform's own `TenantImportPlan` carries the same string for the same reason: the plan is
   * JSON by the time the admin sees it. The vocabulary is owned once, by the enum.
   */
  mode: string;
  basis: 'noTable' | 'naturalKey' | 'empty' | 'aboveSequence' | 'belowSequence';
  minId: number | null;
  taken: number | null;
  opaqueJsonColumns: string[];
  repointedReferences: Array<{ column: string; path: string[]; targetTable: string }>;
  droppedColumns: string[];
}
