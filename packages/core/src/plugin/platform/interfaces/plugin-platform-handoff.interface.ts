/** A claim the platform part parked for the console that asked (`PluginPlatformHandoffs.spend`). */
export interface IPluginPlatformHandoff {
  /** The site or workspace the ticket was minted for; null on an installation with no tenants. */
  tenantId: string | null;
  /** The account that minted the ticket. */
  userId: string;
  keys: string[];
  payload: unknown;
  returnTo: string;
}
