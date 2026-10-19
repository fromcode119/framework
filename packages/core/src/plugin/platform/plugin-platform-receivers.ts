/**
 * Each plugin's tenant-part receiver (`context.platform.onDelivery`), by slug.
 *
 * One per plugin, replaced on every registration: a plugin's restarted process registers its receiver
 * again under a new handler id, and a delivery must reach the CURRENT process, never the one it replaced.
 */
export class PluginPlatformReceivers {
  private static readonly receivers = new Map<string, (payload: unknown) => unknown>();

  static set(slug: string, receiver: (payload: unknown) => unknown): void {
    PluginPlatformReceivers.receivers.set(slug, receiver);
  }

  static get(slug: string): ((payload: unknown) => unknown) | undefined {
    return PluginPlatformReceivers.receivers.get(slug);
  }

  static forget(slug: string): void {
    PluginPlatformReceivers.receivers.delete(slug);
  }
}
