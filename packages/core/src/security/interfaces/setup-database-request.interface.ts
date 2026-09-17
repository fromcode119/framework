import type { IExternalDatabaseServer } from '@core/security/interfaces/external-database-server.interface';

/** What the wizard posts. `server` present means "a database I run"; absent means the bundled one. */
export interface ISetupDatabaseRequest {
  readonly driver: unknown;
  readonly server?: IExternalDatabaseServer;
}
