import { bound } from '@fromcode119/reactor';

/**
 * Server stand-in for `PluginApiRegistryStore`, the `useSyncExternalStore` SOURCE behind
 * `ContextHooks.usePluginsNamespace`.
 *
 * Only the subscription half. The registry contents themselves live in `ThemeServerRegistry` (filled
 * when the plugin bundles are imported) and reach the context through its `pluginApi` / `hasPluginApi`
 * — this class exists because the store contract must be honoured or every theme component that reaches
 * for a sibling plugin throws mid-render.
 *
 * `getServerSnapshot` is the member that matters: React calls it (never `getSnapshot`) while rendering
 * on the server, and its absence is a hard `TypeError`. Constant, because plugin bundles are imported
 * once per process, before any render — the registry never changes DURING a render.
 */
export class ServerPluginApiSubscription {
  @bound subscribe(): () => void {
    return ServerPluginApiSubscription.unsubscribe;
  }

  @bound getSnapshot(): number {
    return 0;
  }

  @bound getServerSnapshot(): number {
    return 0;
  }

  private static unsubscribe(): void {
    /* nothing subscribes server-side: the registry can never change during a single render */
  }
}
