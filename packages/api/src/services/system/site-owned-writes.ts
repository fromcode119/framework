import { TenantMode } from '@fromcode119/core';

/**
 * Can this request write a site's own records — media, people?
 *
 * Yes when a site is bound to it, and yes on a single-site installation (no rows in
 * `_system_tenants`): there the boot sweep takes every table back out of row-level security
 * (`SchemaTenantIsolationService.removeTenantIsolation`), so a record with no site is simply the
 * site's record. That holds on Postgres too — a database that COULD keep sites apart but has only
 * the one site. Asking whether the driver supports isolation instead refused every self-service
 * profile save and upload on such an installation.
 *
 * Only the platform scope of a multi-site installation answers no: a site must be chosen first.
 */
export class SiteOwnedWrites {
  static readonly REQUIRED = 'site_required';

  static possible(req: object): boolean {
    if (String((req as { tenantId?: unknown }).tenantId ?? '').trim()) return true;
    return !TenantMode.isEnabled();
  }
}
