import type { DatabaseDriverChoice } from '@core/security/enums/database-driver-choice.enum';

/** What is written. The privileged bootstrap credential is deliberately not part of it. */
export interface IDatabaseConnectionFile {
  readonly driver: DatabaseDriverChoice;
  readonly runtimeUrl: string;
  readonly migrationUrl: string;
}
