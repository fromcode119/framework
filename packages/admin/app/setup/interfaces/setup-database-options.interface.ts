import type { ISetupDatabaseDriver } from '@/app/setup/interfaces/setup-database-driver.interface';

/**
 * What the api tells the wizard about this deployment's database choices.
 *
 * Mirrors `ISetupDatabaseOptions` on the server, which is the only thing that fills it: every field
 * here is a fact the deployment declared, so the step can state what will be provisioned instead of
 * showing a placeholder somebody has to guess at.
 */
export interface ISetupDatabaseOptions {
  readonly drivers: ISetupDatabaseDriver[];
  /** The database this deployment ships with itself, or null when it ships none. */
  readonly bundled: {
    /** Which driver it speaks. A driver it does not speak can only be set up against your own server. */
    readonly driver: string;
    readonly host: string;
    readonly port: number;
    readonly database: string;
    readonly ownerRole: string;
    readonly runtimeRole: string;
  } | null;
  readonly sqliteFile: string;
  readonly connectionFile: string;
}
