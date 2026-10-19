/** What a sealed `context.platform` ticket carries (`PluginPlatformTicket`). */
export interface IPluginPlatformTicket {
  slug: string;
  /** The site or workspace that asked; null on an installation with no tenants. */
  tenantId: string | null;
  /** Absolute address the browser returns to when the connection is done. */
  returnTo: string;
  /** Epoch milliseconds after which the ticket is refused. */
  exp: number;
  nonce: string;
}
