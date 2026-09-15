import { Enum } from '@fromcode119/react-class-components';

/**
 * The datasets the FRAMEWORK itself holds about a person.
 *
 * Declared once, because the same seven keys were spelled as bare strings in the descriptor list and
 * again in two switches, and a key that agrees in one place and not the others is a dataset an
 * operator can configure and an erasure never reaches — silently, since a `switch` with no matching
 * `case` simply does nothing.
 *
 * Plugins do NOT appear here: they declare their own datasets at runtime through the registry, and
 * the framework may not name them.
 */
export class PersonalDataDatasetKey extends Enum {
  static readonly ACCOUNT = new PersonalDataDatasetKey('account');
  static readonly PERSON = new PersonalDataDatasetKey('person');
  static readonly SESSIONS = new PersonalDataDatasetKey('sessions');
  static readonly ROLES = new PersonalDataDatasetKey('roles');
  static readonly RECORD_VERSIONS = new PersonalDataDatasetKey('record-versions');
  static readonly AUDIT_LOG = new PersonalDataDatasetKey('audit-log');
  static readonly SYSTEM_LOG = new PersonalDataDatasetKey('system-log');

  private constructor(value: string) {
    super(value);
  }
}
