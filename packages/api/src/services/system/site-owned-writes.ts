import { TenantMode } from '@fromcode119/core';

/**
 * Can this request write a site's own records — media, people?
 *
 * Only when a site is bound to it, or when the database keeps no owner on such records at all. Two
 * cases answer no: the platform scope of a multi-site installation (no site chosen), and an installation
 * whose database keeps sites apart but has no site yet — a fresh install, where every upload used to
 * fail with a database error instead of saying a site is needed.
 */
export class SiteOwnedWrites {
  static readonly REQUIRED = 'site_required';

  static possible(req: object): boolean {
    if (String((req as { tenantId?: unknown }).tenantId ?? '').trim()) return true;
    return !TenantMode.isIsolationSupported();
  }
}
