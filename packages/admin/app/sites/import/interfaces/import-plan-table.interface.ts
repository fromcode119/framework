/**
 * One table in an import plan, as the operator is shown it before deciding.
 *
 * A data shape, so an interface in its own file rather than a `type` beside the component — the same
 * placement every other contract in this tree uses.
 */
export interface IImportPlanTable {
  name: string;
  rows: number;
  mode: 'preserve' | 'remap' | 'skip';
  basis: 'noTable' | 'naturalKey' | 'empty' | 'aboveSequence' | 'belowSequence';
  minId: number | null;
  taken: number | null;
  opaqueJsonColumns: string[];
  repointedReferences: Array<{ column: string; path: string[]; targetTable: string }>;
  droppedColumns: string[];
}
