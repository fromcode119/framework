/** What `context.platform.claim` did. */
export interface IPluginPlatformClaimResult {
  /** False when the ticket was missing, expired, sealed for another plugin, or not readable here. */
  valid: boolean;
  /** The keys now owned by the ticket's site or workspace (including ones it already owned). */
  granted: string[];
  /** The keys another site or workspace owns — left with that owner. */
  refused: string[];
  /** Whether the payload reached the owner's receiver. */
  delivered: boolean;
  /** Where the tenant part asked the browser to go afterwards; '' when the ticket is not valid. */
  returnTo: string;
}
