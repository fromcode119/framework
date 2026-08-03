/**
 * Subscription surface of the plugin API registry (implemented by `PluginApiRegistryStore`).
 * Exposed on the context so `usePluginsNamespace` consumers can subscribe via
 * `useSyncExternalStore` and re-render exactly once per registration batch.
 */
export interface IPluginApiSubscription {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
  getServerSnapshot: () => number;
}
