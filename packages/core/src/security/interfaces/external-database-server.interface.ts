/** A database the operator already runs, described by them. Nothing here is created by this platform. */
export interface IExternalDatabaseServer {
  readonly host: string;
  readonly port?: number | string;
  readonly database: string;
  /** The role that SERVES REQUESTS. On a driver that isolates, it must own nothing. */
  readonly user: string;
  readonly password?: string;
  /** The role that owns the schema and runs migrations. Required wherever isolation is real. */
  readonly ownerUser?: string;
  readonly ownerPassword?: string;
}
