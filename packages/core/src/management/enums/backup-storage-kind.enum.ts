import { Enum } from '@fromcode119/react-class-components';

/** Which store a backup artifact lives in. */
export class BackupStorageKind extends Enum {
  static readonly SYSTEM = new BackupStorageKind('system');
  static readonly DATABASE = new BackupStorageKind('database');

  private constructor(value: string) {
    super(value);
  }
}
