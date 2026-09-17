import type { IBundledDatabaseTarget } from '@core/security/interfaces/bundled-database-target.interface';

/** What the wizard shows. Every field here appears on screen before anything is committed. */
export interface ISetupDatabaseOptions {
  readonly drivers: Array<{
    value: string;
    isAvailable: boolean;
    isSingleSiteOnly: boolean;
    hasBundledServer: boolean;
    needsOwnerRole: boolean;
    defaultPort: number;
  }>;
  readonly bundled: IBundledDatabaseTarget | null;
  readonly sqliteFile: string;
  readonly connectionFile: string;
}
