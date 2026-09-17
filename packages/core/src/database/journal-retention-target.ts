import { SystemConstants } from '@core/constants/system.constants';

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

/**
 * The journals this platform prunes, and the rules each one is pruned by.
 *
 * A LIST, not three services. The sweep is identical for every journal — one platform-admin scope,
 * a batched delete by id, a per-owner breakdown before anything goes — and the tables differ only in
 * the five values below. Eleven near-identical settings-migration classes were written and deleted in
 * this codebase once already; the lesson is in CLAUDE.md.
 *
 * `_system_record_versions` is deliberately ABSENT. It is not a journal: every row is a restore point
 * behind a working Restore button, and age is the wrong axis — a stable record's only versions are
 * its oldest, so an age sweep would destroy exactly the history worth keeping while sparing churn.
 * If it ever needs a bound it is a per-record count cap applied at write time, which is a different
 * mechanism and does not belong in a sweeper.
 */
export class JournalRetentionTargets {
  static all(options: { auditAfterPrune?: (summary: IJournalPruneSummary) => Promise<void> } = {}): IJournalRetentionTarget[] {
    return [
      {
        table: SystemConstants.TABLE.LOGS,
        timestampField: 'timestamp',
        settingKey: SystemConstants.META_KEY.LOG_RETENTION_DAYS,
        label: 'logs',
      },
      {
        table: SystemConstants.TABLE.AUDIT_LOGS,
        timestampField: 'created_at',
        settingKey: SystemConstants.META_KEY.AUDIT_RETENTION_DAYS,
        label: 'audit',
        minimumDays: SystemConstants.AUDIT_RETENTION_MIN_DAYS,
        afterPrune: options.auditAfterPrune,
      },
    ];
  }
}
