import { TenantPolicySpec } from '@database/tenant/policies/tenant-policy-spec';
import type { ITenantPolicyRenderer } from '@database/interfaces/tenant-policy-renderer.interface';

/**
 * A tenant may read the handful of deployment truths it cannot own, and nothing else, so one key
 * never resolves to two visible rows.
 */
export class PlatformKeysVisiblePolicySpec extends TenantPolicySpec {
  constructor(table: string, readonly keyColumn: string, readonly platformKeys: string[]) {
    super(table);
  }

  render<T>(renderer: ITenantPolicyRenderer<T>): T {
    return renderer.platformKeysVisible(this);
  }
}
