import { Enum } from '@fromcode119/react-class-components/lang';
import { SystemConstants } from '@core/constants/system.constants';
import { PersonalDataDatasetKey } from '@core/plugin/services/people/enums/personal-data-dataset-key.enum';

/**
 * The two journals, each carrying WHERE it lives and WHICH column holds the identifiers.
 *
 * Those three facts travelled separately as `key === 'audit-log' ? TABLE.AUDIT_LOGS : TABLE.LOGS`
 * and `key === 'audit-log' ? 'metadata' : 'context'`, restated at every site that touched a journal.
 * Three ternaries over one fact is three places to disagree, and the failure would be silent: the
 * wrong blob name scrubs nothing and reports that it scrubbed nothing, which reads exactly like a
 * subject who had no journal rows.
 */
export class PersonalDataJournal extends Enum {
  /** The security record, and this platform's EU AI Act Art. 12 store. */
  static readonly AUDIT = new PersonalDataJournal(
    PersonalDataDatasetKey.AUDIT_LOG.value, SystemConstants.TABLE.AUDIT_LOGS, 'metadata',
  );
  /** Operational logging. Its `message` carries identifiers too, which the audit trail's does not. */
  static readonly SYSTEM = new PersonalDataJournal(
    PersonalDataDatasetKey.SYSTEM_LOG.value, SystemConstants.TABLE.LOGS, 'context',
  );

  private constructor(
    value: string,
    /** The table this journal is stored in. */
    readonly table: string,
    /** The JSON column holding the subject's identifiers. */
    readonly blob: string,
  ) {
    super(value);
  }

  /** Only the audit trail is the security record; only the system log scrubs its `message`. */
  get isAudit(): boolean {
    return this === PersonalDataJournal.AUDIT;
  }
}
