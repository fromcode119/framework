/** What was actually removed, for a target that records its own sweep. */
export interface IJournalPruneSummary {
  readonly table: string;
  readonly retentionDays: number;
  readonly cutoff: string;
  /** What the count said before deleting. */
  readonly planned: number;
  /** What the batches actually removed. */
  readonly removed: number;
  /** `platform=41044, hub=16` — who the removed rows belonged to. */
  readonly owners: string;
}
