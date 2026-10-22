/** A UNIQUE rule that ignores the tenant column, as found in the catalog. */
export interface ITenantBlindUniqueRule {
  name: string;
  columns: string[];
  /** A partial index's WHERE, as the catalog renders it. Absent for a constraint or a whole-table index. */
  predicate?: string;
}
