import type { IDatabaseConnectionFile } from '@core/security/interfaces/database-connection-file.interface';
import type { DatabaseDriverChoice } from '@core/security/enums/database-driver-choice.enum';

/** What is read back. The driver is `undefined` when the file names one this build does not ship. */
export interface IStoredDatabaseConnection extends Omit<IDatabaseConnectionFile, 'driver'> {
  readonly driver: DatabaseDriverChoice | undefined;
}
