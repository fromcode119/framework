import { RequestContextUtils } from '@core/context/request-context';

/**
 * One wrapper for every CORE integration that has to answer as a property rather than an await.
 *
 * Most integrations are resolved through `IntegrationManager.get()`, which is keyed by tenant, so they
 * already serve each site its own configuration. `email`, `storage` and `cache` are the exceptions: they
 * are fields, resolved once at boot with no tenant in scope, because callers read them synchronously
 * (`manager.integrations.email.send(...)`). That made them process-wide — a shop that had entered its own
 * SMTP credentials silently sent nothing, because the platform's `mock` driver had won the field at boot.
 *
 * Rather than a bespoke per-integration class, this wraps ANY such surface once: a method call resolves
 * the current tenant's instance first and delegates, and with no tenant in scope the platform's own
 * instance answers, which is what framework work (auth mail, admin notifications) needs.
 *
 * SYNCHRONOUS methods are supported by NAMING them. A wrapper cannot make a synchronous method wait for
 * a lookup, so those are answered from an instance resolved earlier — `IntegrationTenantAccess`, warmed
 * when the tenancy middleware binds the request, exactly as `PluginTenantAccess` warms the plugin gates
 * for the same reason. `MediaManager.publicUrl` and `QueueManager.applySettings` are the cases.
 */
export class TenantScopedIntegration {
  /**
   * @param platform   the platform's own instance, used with no tenant bound and as the fallback.
   * @param forTenant  resolves a tenant's instance; used for every ASYNC method.
   * @param syncMethods method names that must NOT become promises — `MediaManager.publicUrl`,
   *   `QueueManager.applySettings`. They are NAMED rather than detected, because whether a function
   *   returns a promise cannot be read off it, and guessing wrong turns a string into a `Promise<string>`
   *   that renders as `[object Promise]` in a page.
   * @param syncFor    the synchronous lookup for those methods, warmed when the request was bound.
   */
  static wrap<T extends object>(
    platform: () => T,
    forTenant: (tenantId: string) => Promise<T>,
    syncMethods: readonly string[] = [],
    syncFor: (() => T | undefined) = () => undefined,
  ): T {
    const named = new Set(syncMethods);
    return new Proxy({} as T, {
      get(_target, prop) {
        const current = platform() as Record<string | symbol, unknown>;
        const value = current?.[prop];
        // Data and accessors read from the platform instance: only calls can wait for a lookup.
        if (typeof value !== 'function') return value;

        // A named synchronous method answers from the warmed instance, or from the platform when this
        // is framework work with no tenant bound. It never returns a promise.
        if (typeof prop === 'string' && named.has(prop)) {
          return (...args: unknown[]) => {
            const instance = syncFor() as Record<string | symbol, unknown> | undefined;
            const target = instance?.[prop] instanceof Function ? instance : current;
            return (target[prop] as (...a: unknown[]) => unknown).apply(target, args);
          };
        }

        return (...args: unknown[]) => {
          const tenantId = RequestContextUtils.getTenantId();
          if (!tenantId) return (value as (...a: unknown[]) => unknown).apply(current, args);
          return forTenant(tenantId).then((instance) =>
            (instance as Record<string | symbol, unknown>)[prop] instanceof Function
              ? ((instance as Record<string | symbol, unknown>)[prop] as (...a: unknown[]) => unknown).apply(instance, args)
              : (value as (...a: unknown[]) => unknown).apply(current, args));
        };
      },
    });
  }
}
