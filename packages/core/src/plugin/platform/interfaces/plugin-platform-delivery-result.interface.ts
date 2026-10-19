/** What `context.platform.deliver` did. `reason` says why nothing was delivered. */
export interface IPluginPlatformDeliveryResult {
  delivered: boolean;
  /** A `PluginPlatformDeliveryReason` value: 'unclaimed', 'disabled' or 'no-receiver'. */
  reason?: string;
  /** What the receiver returned. */
  result?: unknown;
}
