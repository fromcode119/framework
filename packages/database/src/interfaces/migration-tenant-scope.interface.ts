/**
 * What the migration runner hands a migration so it can reach every site's rows.
 *
 * On a multi-tenant deployment a tenant-owned table is behind FORCE row-level security, and a migration
 * runs with no site bound — so a plain `find`/`update` sees NONE of those rows and a data migration
 * completes having changed nothing. `forEachTenant` runs `fn` once per site with that site bound; on a
 * single-tenant deployment it runs `fn` once, unscoped, with `tenantId` `''`.
 */
export interface IMigrationTenantScope {
  forEachTenant(fn: (tenantId: string) => Promise<void>): Promise<void>;
}
