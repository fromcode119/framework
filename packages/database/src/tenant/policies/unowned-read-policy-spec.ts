import { TenantPolicySpec } from '@database/tenant/policies/tenant-policy-spec';
import type { ITenantPolicyRenderer } from '@database/interfaces/tenant-policy-renderer.interface';

/**
 * A tenant's own rows, PLUS the ones nobody owns — readable by every tenant, writable only by the
 * tenant that owns them, and an unowned row writable by nobody.
 *
 * For a table where losing a row is the DANGEROUS direction, so the generic predicate's strict
 * equality (an unowned row matches in no scope at all) cannot be used. The do-not-email list is the
 * case: an unowned suppression predates per-site suppression, and the only safe reading of it is
 * "this person opted out, and no site has established otherwise". Making it invisible would silently
 * resume mailing someone who asked not to be mailed.
 *
 * Four per-command policies for the same reason as `SharedReadPolicySpec`: `WITH CHECK` does not
 * govern DELETE, so a single `USING (own OR unowned)` would let any tenant delete the unowned rows.
 */
export class UnownedReadPolicySpec extends TenantPolicySpec {
  render<T>(renderer: ITenantPolicyRenderer<T>): T {
    return renderer.unownedRead(this);
  }
}
