import type { IPluginPlatformClaimResult } from '@core/plugin/platform/interfaces/plugin-platform-claim-result.interface';
import type { IPluginPlatformDeliveryResult } from '@core/plugin/platform/interfaces/plugin-platform-delivery-result.interface';
import type { IPluginSettingsSchema } from '@core/plugin/interfaces/plugin-settings-schema.interface';

/**
 * The `context.platform` surface of {@link PluginContext}: one plugin with a PLATFORM part that answers
 * for every site or workspace at once (one provider app, one webhook) and a TENANT part that each site or
 * workspace runs for itself.
 *
 * Only a plugin whose manifest declares `platform: true` may use it, and only an installation's own
 * plugins can declare that — a site's uploaded plugin is refused (`TenantPluginPackagePolicy`).
 *
 * The two parts never meet:
 * - the platform part never learns which site or workspace owns what: it hands the framework an opaque
 *   ticket and a key, and the framework does the routing;
 * - the tenant part never reads the platform settings: they are answered only where no tenant is bound.
 *
 * On an installation with no tenants there is one owner, and every claim and delivery is its own.
 */
export interface IPluginContextPlatform {
  /** Declares the platform part's settings (a provider app's id and secret). Field names must not repeat a tenant setting's. */
  registerSettings(schema: IPluginSettingsSchema): void;

  /** The platform settings, secrets opened. Platform part only: refused while a tenant is bound. */
  getSettings(): Promise<Record<string, unknown>>;

  /**
   * TENANT part: the absolute address of the platform route `path` (under `platform/`), carrying a sealed
   * ticket that names the current site or workspace. The platform part reads it as `?ticket=` and passes it
   * on to {@link claim} — usually through a provider's OAuth `state`. `returnTo` is where the browser goes
   * when the connection is done; a relative path is resolved against this site's console.
   */
  connectUrl(path: string, returnTo?: string): Promise<string>;

  /**
   * PLATFORM part: gives every `keys` entry to the owner the ticket names, then delivers `payload` to that
   * owner's receiver ({@link onDelivery}). A key another owner already holds is refused, never moved.
   */
  claim(ticket: string, keys: string[], payload?: unknown): Promise<IPluginPlatformClaimResult>;

  /** PLATFORM part: hands `payload` to whoever owns `key`, inside that owner's isolation. */
  deliver(key: string, payload: unknown): Promise<IPluginPlatformDeliveryResult>;

  /** TENANT part: the keys the current site or workspace owns. */
  claims(): Promise<string[]>;

  /** TENANT part: gives up `keys` (all of them when omitted). Returns how many were released. */
  release(keys?: string[]): Promise<number>;

  /** TENANT part: receives what the platform part delivers. Runs with the owner's tenant bound. */
  onDelivery(handler: (payload: unknown) => unknown): void;
}
