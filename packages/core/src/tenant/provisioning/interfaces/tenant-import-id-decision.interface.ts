import type { TenantImportIdMode } from '@core/tenant/provisioning/enums/tenant-import-id-mode.enum';

/** What an import decided about one table's ids, and the two figures the operator is shown about it. */
export interface ITenantImportIdDecision {
  mode: TenantImportIdMode;

  /** A `TenantImportIdBasis` VALUE, carried as a string for the same reason `mode` is on the plan. */
  basis: string;

  /** The highest id this platform has already handed out for this table. */
  taken: number;

  /** The lowest id in the archive, or `null` when no row carries a numeric one. */
  minId: number | null;
}
