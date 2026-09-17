import { TenantPolicySpec } from '@database/tenant/policies/tenant-policy-spec';
import type { ITenantPolicyRenderer } from '@database/interfaces/tenant-policy-renderer.interface';

/**
 * An asset may be marked shared: READABLE by every tenant, writable by none but its owner.
 *
 * Renders four per-command policies, because `WITH CHECK` does not govern DELETE — a single
 * `USING (own OR shared)` would let a borrower delete another customer's file.
 */
export class SharedReadPolicySpec extends TenantPolicySpec {
  constructor(table: string, readonly sharedColumn: string) {
    super(table);
  }

  render<T>(renderer: ITenantPolicyRenderer<T>): T {
    return renderer.sharedRead(this);
  }
}
