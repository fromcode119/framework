/**
 * One theme or plugin runtime bundle the storefront has to `import()`: its dedupe key and its
 * versioned URL. Produced by `PluginLoaderMountService` from the `/system/frontend` payload; consumed by
 * `PluginLoader` (the live path) and by the islands runtime's eager loader — ONE URL builder, so the two
 * never fetch the same file under two cache keys.
 */
export class RuntimeModuleRef {
  constructor(
    readonly key: string,
    readonly url: string,
    /** `loadStrategy: 'idle'` — deferred to browser idle time instead of loaded eagerly. */
    readonly idle: boolean = false,
    /** The owning plugin's slug ('' for the theme entry) — what the islands skip list is keyed by. */
    readonly pluginSlug: string = '',
  ) {}
}
