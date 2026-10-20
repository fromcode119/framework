/** What a sealed `context.platform` ticket carries (`PluginPlatformTicket`). */
export interface IPluginPlatformTicket {
  slug: string;
  /** The site or workspace that asked; null on an installation with no tenants. */
  tenantId: string | null;
  /** The account that asked. Only that account can finish the connection (`context.platform.complete`). */
  userId: string;
  /** Absolute address the browser returns to when the connection is done. */
  returnTo: string;
  /** Absolute address of the tenant part's completion route, on the console that asked. */
  completeUrl: string;
  /** Epoch milliseconds after which the ticket is refused. */
  exp: number;
  /** The ticket's identity: recorded when it is used (`PluginPlatformHandoffs`), so it is used once. */
  nonce: string;
}
