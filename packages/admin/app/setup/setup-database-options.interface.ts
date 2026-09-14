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

export interface ISetupDatabaseDriver {
  readonly value: string;
  /** False for a driver this build ships but cannot install yet; it is listed, not offered. */
  readonly isAvailable: boolean;
  /** True when choosing it means this installation can never host a second site. */
  readonly isSingleSiteOnly: boolean;
  /** True when this deployment ships a server speaking it, so nothing has to be typed. */
  readonly hasBundledServer: boolean;
  /** True when the form must ask for a second, schema-owning role — see the isolation note. */
  readonly needsOwnerRole: boolean;
  readonly defaultPort: number;
}

/** A server the operator runs, as the form collects it. */
export interface ISetupDatabaseServer {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ownerUser: string;
  ownerPassword: string;
}
