import type { ICapabilityProvider } from '@core/plugin/capabilities/interfaces/capability-provider.interface';

/**
 * Ask for WHAT you need, not WHO provides it.
 *  - `provide` registers this plugin as a provider of a capability (its slug is stamped by the framework).
 *  - `all` / `one` return the providers of a capability, which the consumer then calls through
 *    `context.plugins.namespace(provider.namespace).call(provider.slug, method, …)` — so it never names
 *    a specific plugin, and a second or replacement provider needs no change in the consumer.
 */
export interface IPluginContextCapabilities {
  provide(capability: string, meta?: { id?: string; label?: string; priority?: number }): void;
  all(capability: string): ICapabilityProvider[];
  one(capability: string): ICapabilityProvider | null;
}
