/**
 * Where SERVER-only core services are registered, so `CoreServices` can hand them out without importing
 * them.
 *
 * `CoreServices` is reachable from the browser — themes and plugin UIs use it for the design runtime
 * bridge, and it is published on the runtime bridge. Its getters lazily CONSTRUCT their services, but a
 * static `import` is a static dependency regardless of whether the getter is ever called, so every
 * client bundle carried the page-contract tree, the seeder and the collection-write compatibility layer:
 * ~47 KB of server code that no browser can use. That is the boundary CLAUDE.md draws — the client
 * surface must not own server services.
 *
 * The server registers a factory per key at boot (`ServerCoreServices`); `CoreServices` looks the key up
 * and memoises the instance. Same public API for callers, including the documented plugin one
 * (`CoreServices.getInstance().defaultPageContracts.register(...)`), and the modules never enter a client
 * graph. Calling one of these in a browser throws with a plain message rather than failing obscurely.
 */
export class ServerServiceRegistry {
  private static readonly factories = new Map<string, () => unknown>();

  private static readonly instances = new Map<string, unknown>();

  /** Register a server-only service factory. Called once per key, at server boot. */
  static register(key: string, factory: () => unknown): void {
    ServerServiceRegistry.factories.set(key, factory);
  }

  /** The service for `key`, constructed on first use. Throws when the server never registered it. */
  static require<T>(key: string): T {
    const existing = ServerServiceRegistry.instances.get(key);
    if (existing !== undefined) return existing as T;

    const factory = ServerServiceRegistry.factories.get(key);
    if (!factory) {
      throw new Error(
        `[core] "${key}" is a SERVER-only core service and nothing registered it. `
        + 'It is unavailable in a browser by design; on the server, import "@fromcode119/core" so '
        + 'ServerCoreServices runs its registration.',
      );
    }

    const instance = factory();
    ServerServiceRegistry.instances.set(key, instance);
    return instance as T;
  }

  /** Drop constructed instances (tests). Registrations survive — they are boot-time wiring. */
  static reset(): void {
    ServerServiceRegistry.instances.clear();
  }
}
