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
 * CONTRACT: every method on the wrapped surface must be async. A wrapper cannot make a synchronous
 * method wait for a lookup, so a surface with sync methods (`MediaManager.publicUrl`) must NOT be wrapped
 * — resolving those per tenant needs the callers to await, which is a larger change.
 */
export class TenantScopedIntegration {
  static wrap<T extends object>(platform: () => T, forTenant: (tenantId: string) => Promise<T>): T {
    return new Proxy({} as T, {
      get(_target, prop) {
        const current = platform() as Record<string | symbol, unknown>;
        const value = current?.[prop];
        // Data and accessors read from the platform instance: only calls can wait for a lookup.
        if (typeof value !== 'function') return value;
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
