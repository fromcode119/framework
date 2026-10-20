/** What `context.platform.abandon` did. */
export interface IPluginPlatformAbandonResult {
  /** False when the ticket was missing, expired, already used, sealed for another plugin, or not readable here. */
  valid: boolean;
  /** Where the tenant part asked the browser to go afterwards; '' when the ticket is not valid. */
  returnTo: string;
}
