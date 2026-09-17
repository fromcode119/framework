import { TenantPolicySpec } from '@database/tenant/policies/tenant-policy-spec';
import type { ITenantPolicyRenderer } from '@database/interfaces/tenant-policy-renderer.interface';

/**
 * A tenant's own record of what happened on its site.
 *
 * A PLATFORM admin reads every site's (an operator investigating an incident cannot enter each site
 * in turn); an UNTENANTED connection may WRITE with no marker, because boot and migrations log
 * before any tenant is bound.
 */
export class JournalPolicySpec extends TenantPolicySpec {
  render<T>(renderer: ITenantPolicyRenderer<T>): T {
    return renderer.journal(this);
  }
}
