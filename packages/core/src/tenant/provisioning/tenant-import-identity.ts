import { TenantEnvironment } from '@core/enums/tenant-environment.enum';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';

/**
 * What the imported site IS — the archive's own identity, with the operator's overrides on top.
 *
 * Shared rather than copied because two callers now resolve it: the Sites admin, and the
 * `tenant-import` CLI that the migration runbook drives. The defaults below are the whole reason
 * this is one implementation and not two — they are safety rules, and a second copy that drifted on
 * `environment` would import somebody's live shop as the real thing.
 */
export class TenantImportIdentity {
  /**
   * AN IMPORT ARRIVES MUTED.
   *
   * This is the one path that creates a COPY of another deployment, and what it copies is a working
   * shop: real customers in the rows, real payment and courier credentials in the settings.
   * Everywhere else `environment` defaults to `production`, because everywhere else the site being
   * created is the real one. Here the safe direction is the opposite, exactly as it is for
   * `visibility` — an operator says "this is the live one now", never the absence of a flag. Pass
   * `environment: 'production'` explicitly to import a real migration rather than a rehearsal.
   */
  static resolve(archived: Record<string, unknown>, input: Record<string, unknown>): TenantIdentity {
    return TenantIdentity.from({
      id: input.id ?? input.slug ?? archived.slug,
      slug: input.slug ?? archived.slug,
      primaryHost: input.primaryHost ?? archived.primaryHost,
      hostAliases: input.hostAliases ?? archived.hostAliases,
      state: input.state ?? 'active',
      // Archives written before T6 carry no kind: they were exported from sites.
      kind: input.kind ?? archived.kind ?? 'site',
      environment: input.environment ?? TenantEnvironment.NON_PRODUCTION.value,
      // Read, not ignored. `TenantIdentity.from` defaults an absent visibility to PRIVATE, which is
      // the right fail-closed answer — but dropping the operator's choice on the floor meant the
      // control could not publish a site even when they asked it to, and the screen gave no hint.
      visibility: input.visibility,
      appearance: input.appearance ?? archived.appearance ?? '',
    });
  }
}
