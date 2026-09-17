import type { IJournalPruneSummary } from '@core/database/interfaces/journal-prune-summary.interface';

/** What a journal-retention sweep needs to know about one table. */
export interface IJournalRetentionTarget {
  /** The table to prune. */
  readonly table: string;
  /** The column carrying the row's age. `_system_logs` says `timestamp`; `_system_audit_logs` says `created_at`. */
  readonly timestampField: string;
  /** The declared setting holding the window, in days. Empty or 0 means keep forever. */
  readonly settingKey: string;
  /** What this journal is called in a log line — `[Retention:audit]`. */
  readonly label: string;
  /**
   * The shortest window this journal will accept. A configured value below it is REFUSED with the
   * reason, never clamped. Absent means any positive window is acceptable.
   */
  readonly minimumDays?: number;
  /** Called after a successful prune, for a journal that must record its own pruning. */
  readonly afterPrune?: (summary: IJournalPruneSummary) => Promise<void>;
}
