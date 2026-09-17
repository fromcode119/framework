import { SystemConstants } from '@core/constants/system.constants';
import type { IJournalRetentionTarget } from '@core/database/interfaces/journal-retention-target.interface';
import type { IJournalPruneSummary } from '@core/database/interfaces/journal-prune-summary.interface';

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
