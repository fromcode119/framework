import { TenantPolicySpec } from '@database/tenant/policies/tenant-policy-spec';
import type { ITenantPolicyRenderer } from '@database/interfaces/tenant-policy-renderer.interface';

/**
 * Per tenant with no shared keys, plus the untenanted branch that keeps a deployment with no tenants
 * working. A plugin's configuration is never platform-level.
 */
export class TenantSettingsPolicySpec extends TenantPolicySpec {
  render<T>(renderer: ITenantPolicyRenderer<T>): T {
    return renderer.tenantSettings(this);
  }
}
