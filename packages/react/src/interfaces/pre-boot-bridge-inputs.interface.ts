import type { PluginApiRegistryStore } from '@react/context/plugin-api-registry-store';

/** What the islands runtime knows before any provider exists — enough to install the pre-boot bridge. */
export interface IPreBootBridgeInputs {
  apiUrl: string;
  /** The public `/system/frontend` payload the document inlined. */
  frontendConfig: Record<string, any>;
  locale: string;
  /** The document locale's server translations (`/system/i18n?locale=`), inlined by the document. */
  translations: Record<string, any>;
  /** Shared with the provider seed, so a client registered at evaluation is in the live registry. */
  pluginApiStore: PluginApiRegistryStore;
  /** Shared with the provider seed, so `on()` subscriptions made at evaluation receive live `emit()`s. */
  events: Map<string, Set<(data: any) => void>>;
  /** The public `PluginsProvider` class (handed to bundles through the bridge). */
  PluginsProvider: unknown;
  runtimeModules?: Record<string, any>;
}
