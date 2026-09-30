import type { ITenantScopeLease } from '@database/interfaces/tenant-scope-lease.interface';

/**
 * The lease of a driver that keeps nothing between scopes: every run is its own `withTenant`.
 * Isolation is whatever that driver's `withTenant` provides — including its refusal, when it has none.
 */
export class PassThroughTenantLease implements ITenantScopeLease {
  constructor(private readonly tenantId: string, private readonly withTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.withTenant(this.tenantId, fn);
  }

  async close(): Promise<void> {
    // nothing is held between runs
  }
}
