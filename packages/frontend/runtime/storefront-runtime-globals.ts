import { SystemIconProvider } from '@/lib/system-icon-provider';

/**
 * The browser globals every theme and plugin bundle expects before it evaluates, other than the runtime
 * registry itself: the `process` shim and the framework icon provider.
 *
 * These were `GlobalInitializer`'s render-time side effects. Under the islands runtime they run from
 * `FrontendRuntimeEntry.boot()`, BEFORE any React tree exists, because the theme bundle is evaluated
 * before the provider mounts; the registry's React / ReactDOM / JSX / lucide / bridge entries follow
 * immediately from `ContextRuntimeBridge.installPreBootBridge`. `GlobalInitializer` (the Next path)
 * calls this same method before its own registry writes, so the two paths cannot drift. Idempotent.
 */
export class StorefrontRuntimeGlobals {
  static install(): void {
    // Polyfill process for browser compatibility in themes/plugins
    (window as any).process = {
      env: { NODE_ENV: 'production' },
    };

    // Explicit, ordered registration — this used to happen as a side effect of importing `lib/icons`,
    // so it ran at whatever point the module graph happened to reach that file.
    SystemIconProvider.register();
  }
}
