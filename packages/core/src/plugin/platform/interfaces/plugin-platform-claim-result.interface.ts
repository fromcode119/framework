/** What `context.platform.claim` did. */
export interface IPluginPlatformClaimResult {
  /** False when the ticket was missing, expired, already used, sealed for another plugin, or not readable here. */
  valid: boolean;
  /**
   * Where to send the browser: the tenant part's completion route on the console that asked, carrying a
   * one-time handoff. Nothing is claimed until that console's signed-in operator — the one who asked —
   * opens it. '' when the ticket is not valid.
   */
  continueTo: string;
}
