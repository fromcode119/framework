import { ContextProviderStateService } from '@react/context/context-provider-state-service';

/**
 * Subscribable registry for plugin API clients.
 *
 * Replaces the old mutate-silently `pluginAPIs` object: registrations now bump a version
 * counter (the `useSyncExternalStore` snapshot) and notify subscribers in a microtask, so
 * consumers re-render exactly once per registration batch instead of only "discovering"
 * new APIs on unrelated provider re-renders.
 *
 * Render-phase safety: `register()` never calls setState — it mutates the internal map,
 * bumps the version synchronously (children rendered in the same pass read the fresh
 * snapshot), and coalesces the subscriber notification into a single `queueMicrotask`
 * flush per tick. Subscribers whose last-rendered snapshot already matches are skipped
 * by `useSyncExternalStore`'s `Object.is` check, so the post-commit flush is a no-op for
 * components that rendered after the registration.
 */
export class PluginApiRegistryStore {
  private readonly entries = new Map<string, unknown>();

  private readonly listeners = new Set<() => void>();

  private version = 0;

  private notifyScheduled = false;

  register(namespace: string, slug: string, api: unknown): void {
    if (this.applyRegistration(namespace, slug, api)) {
      this.scheduleNotify();
    }
  }

  /**
   * Registration performed DURING a provider render pass (`usePluginApiRegistration`).
   * Skips the subscriber notification: the registration is committed with the very render
   * that made it, and every `usePluginsNamespace` consumer is also a plugin-context consumer,
   * so it re-renders in that same commit and reads the fresh snapshot. Notifying here would
   * race `useSyncExternalStore`'s passive snapshot bookkeeping and force one redundant
   * re-render of already-consistent subscribers.
   */
  registerFromRender(namespace: string, slug: string, api: unknown): void {
    this.applyRegistration(namespace, slug, api);
  }

  get(namespace: string, slug: string): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    return this.entries.get(ContextProviderStateService.getPluginApiRegistryKey(namespace, slug));
  }

  has(namespace: string, slug: string): boolean {
    return this.get(namespace, slug) !== undefined;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Snapshot for `useSyncExternalStore` — changes ONLY when registry contents change. */
  getSnapshot(): number {
    return this.version;
  }

  /** Registrations are client-only; SSR/hydration always sees the empty registry. */
  getServerSnapshot(): number {
    return 0;
  }

  private applyRegistration(namespace: string, slug: string, api: unknown): boolean {
    const key = ContextProviderStateService.getPluginApiRegistryKey(namespace, slug);
    if (this.entries.get(key) === api) {
      return false;
    }

    this.entries.set(key, api);
    this.version += 1;
    return true;
  }

  private scheduleNotify(): void {
    if (this.notifyScheduled) {
      return;
    }

    // Macrotask (not queueMicrotask): render-phase registrations are committed with the very
    // render that made them, and `useSyncExternalStore` records the rendered snapshot in a
    // passive effect. A microtask notification races that effect (stale recorded snapshot ->
    // one redundant forced re-render); a macrotask runs after the passive-effect flush, so
    // already-consistent subscribers are skipped by the snapshot equality check.
    this.notifyScheduled = true;
    setTimeout(() => {
      this.notifyScheduled = false;
      this.listeners.forEach((listener) => listener());
    }, 0);
  }
}
