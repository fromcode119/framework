/** A database the deployment ships with itself, described by the deployment rather than guessed. */
export interface IBundledDatabaseTarget {
  /** The driver this server speaks — a wizard must not offer a different one against it. */
  readonly driver: string;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly ownerRole: string;
  readonly runtimeRole: string;
}
