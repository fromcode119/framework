import { SystemIconProvider } from '@/lib/system-icon-provider';

/**
 * The browser globals every theme and plugin bundle expects before it evaluates, other than the runtime
 * registry itself: the framework icon provider. (`process.env.NODE_ENV` is inlined by every extension build's
 * `define`, so no `process` shim is installed.)
 *
 * These were `GlobalInitializer`'s render-time side effects. Under the islands runtime they run from
 * `FrontendRuntimeEntry.boot()`, BEFORE any React tree exists, because the theme bundle is evaluated
 * before the provider mounts; the registry's React / ReactDOM / JSX / lucide / bridge entries follow
 * immediately from `ContextRuntimeBridge.installPreBootBridge`. `GlobalInitializer` (the Next path)
 * calls this same method before its own registry writes, so the two paths cannot drift. Idempotent.
 */
export class StorefrontRuntimeGlobals {
  static install(): void {
    // Explicit, ordered registration — this used to happen as a side effect of importing `lib/icons`,
    // so it ran at whatever point the module graph happened to reach that file.
    SystemIconProvider.register();
  }
}
