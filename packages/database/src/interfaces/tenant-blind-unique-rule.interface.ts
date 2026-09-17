/** A UNIQUE rule that ignores the tenant column, as found in the catalog. */
export interface ITenantBlindUniqueRule {
  name: string;
  columns: string[];
}
