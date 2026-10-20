/** What `context.platform.complete` did. */
export interface IPluginPlatformCompletion {
  /**
   * False when the handoff was unknown, already used or expired, or was opened on another site or by
   * another account than the one that asked for the connection. It is spent either way.
   */
  valid: boolean;
  /** The keys now owned by the current site or workspace (including ones it already owned). */
  granted: string[];
  /** The keys another site or workspace owns — left with that owner. */
  refused: string[];
  /** What the platform part handed over with the claim; null when not valid. */
  payload: unknown;
  /** Where the tenant part asked the browser to go afterwards; '' unless the handoff belongs to this site. */
  returnTo: string;
}
