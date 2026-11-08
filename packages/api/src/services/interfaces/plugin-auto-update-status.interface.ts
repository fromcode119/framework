/**
 * What the last automatic plugin check reported — stored as `plugins_auto_update_status` and shown on
 * Settings → Updates, so the operator sees what the switch did instead of trusting that it ran.
 */
export interface IPluginAutoUpdateStatus {
  /** When the last check ran, ISO-8601. */
  checkedAt: string;
  /** When the last batch that actually installed something finished; empty when none has. */
  updatedAt: string;
  /** The plugins that last batch installed. */
  updated: string[];
  /** The plugins the LAST check could not update, with why. */
  failed: { slug: string; error: string }[];
  /** Set when the marketplace could not be asked at all; empty otherwise. */
  error: string;
}
