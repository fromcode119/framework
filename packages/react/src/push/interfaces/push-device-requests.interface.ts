/**
 * How a `PushDevice` reaches the api. The console and the storefront call the same three routes
 * through different clients (the console's own api, the storefront's system scope), so the caller
 * supplies them.
 */
export interface IPushDeviceRequests {
  /** The site's public push key (`GET /system/push/key`). */
  publicKey(): Promise<string>;
  /** Keep this browser's subscription for the signed-in person (`POST /system/push/subscriptions`). */
  save(body: { surface: string; subscription: unknown; label: string }): Promise<void>;
  /** Forget it (`POST /system/push/subscriptions/remove`). */
  remove(endpoint: string): Promise<void>;
}
