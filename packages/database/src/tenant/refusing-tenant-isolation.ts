import type {
  IScopedUniqueRules,
  ITenantIsolation,
  ITenantPolicySpec,
} from '@database/interfaces/tenant-isolation.interface';

/**
 * The isolation capability of a driver that has none: every method REFUSES.
 *
 * It throws rather than doing nothing, for the same reason `BaseDialect.withTenant` throws. A no-op
 * would let `isolateTable` return successfully on MySQL and leave the caller — and the operator —
 * believing a table is isolated when every tenant can read every row, with nothing anywhere to
 * indicate it. A base class must not hand out a security property nobody implemented.
 *
 * Nothing reaches this on a supported deployment: callers that legitimately skip ask
 * `supportsTenantIsolation()` first, and a deployment needing isolation on a driver without it is
 * already refused at boot. Reaching one of these methods therefore means a caller forgot the
 * capability check, and the message says so.
 */
export class RefusingTenantIsolation implements ITenantIsolation {
  constructor(private readonly driver: string) {}

  async addTenantColumn(table: string): Promise<void> {
    return this.refuse('add the ownership column to', table);
  }

  async enforceIsolation(table: string): Promise<void> {
    return this.refuse('isolate', table);
  }

  async isolateTable(table: string): Promise<void> {
    return this.refuse('isolate', table);
  }

  async releaseTable(table: string): Promise<void> {
    return this.refuse('release', table);
  }

  async listPolicies(): Promise<Array<{ table: string; policy: string }>> {
    return this.refuse('list tenant policies on', 'this database');
  }

  async applyPolicy(spec: ITenantPolicySpec): Promise<void> {
    return this.refuse('apply a tenant policy to', spec.table);
  }

  async scopeUniqueRules(table: string): Promise<IScopedUniqueRules> {
    return this.refuse('scope the unique rules of', table);
  }

  async scopeUniqueConstraint(table: string): Promise<void> {
    return this.refuse('scope a unique constraint on', table);
  }

  async countUnassigned(table: string): Promise<number> {
    return this.refuse('count unassigned rows in', table);
  }

  async assignUnassigned(table: string): Promise<number> {
    return this.refuse('assign unassigned rows in', table);
  }

  /**
   * ASYNC, so the refusal arrives as a rejected promise rather than a synchronous throw.
   *
   * Callers write `isolation.applyPolicy(spec).catch(...)` — `SchemaManager` does exactly that for
   * the bespoke policies. A method that promises a `Promise` and throws before returning one skips
   * that `.catch` entirely and unwinds somewhere the caller never looks.
   */
  private async refuse(action: string, subject: string): Promise<never> {
    throw new Error(
      `${this.driver}: this driver has no tenant isolation, so it cannot ${action} "${subject}". `
      + 'Refusing rather than reporting success for isolation that does not exist. '
      + 'Ask supportsTenantIsolation() before reaching for this capability.',
    );
  }
}
