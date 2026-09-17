/**
 * One database driver this build knows about, as the wizard lists it.
 *
 * Every flag is a fact the deployment declared, not a guess: a driver may be shipped yet not
 * installable, may forbid a second site, may come with a server so nothing has to be typed, or may
 * need a second schema-owning role.
 */
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
