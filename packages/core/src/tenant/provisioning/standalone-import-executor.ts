import type { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantImportFiles } from '@core/tenant/provisioning/tenant-import-files';
import { TenantImportRowFilter } from '@core/tenant/provisioning/tenant-import-row-filter';
import { TenantImportUsers } from '@core/tenant/provisioning/tenant-import-users';
import { TenantInstalledPluginSlugs } from '@core/tenant/provisioning/tenant-installed-plugin-slugs';
import { TenantRowInserter } from '@core/tenant/provisioning/tenant-row-inserter';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Restores a tenant archive into a deployment that has NO tenants — the other direction of the move.
 *
 * A site could always come ONTO the platform: `TenantArchiveSource.singleTenant` reads a tenant-less
 * deployment and the importer lands it as a site. The reverse had no path at all. An archive exported
 * from a site could be produced and then not consumed by anything except another platform, so a site
 * could arrive and never leave — which makes the platform a one-way door for somebody else's data.
 *
 * What differs from a site import is ownership, and only ownership:
 *
 *  - No tenant row is created, because a deployment with no tenants is the product's other shape, not
 *    a platform with one customer. Creating one would turn tenancy ON at the next boot and isolate
 *    every table.
 *  - No row-level-security scope is opened. There is nothing to scope to, and on a fresh single
 *    deployment the tables carry no `tenant_id` column to filter on.
 *  - Rows are written with NO owner, which is what every row of a tenant-less deployment looks like.
 *  - No memberships, no per-site plugin enablement, no per-site theme activation: those describe a
 *    site's relationship to a platform, and there is no platform here. The archive's plugins and theme
 *    are installed by the deployment itself.
 *
 * Everything else is deliberately the SAME code: the same reader, the same row filter, the same
 * inserter, the same file handling. Which rows are a site's to take does not depend on who ends up
 * owning them.
 *
 * IDS ARE KEPT. There is no second site to collide with, so nothing is renumbered and no reference
 * needs rewriting — the property the platform side had to widen a primary key to obtain.
 */
export class StandaloneImportExecutor {
  private readonly logger = new Logger({ namespace: 'standalone-import' });

  constructor(
    private readonly db: IDatabaseManager,
    private readonly tables: TenantTableDescriptor[],
    private readonly uploadsDir: string,
    /** The passphrase this archive's secrets were sealed under, when it carries any. */
    private readonly transitPassphrase: string | null = null,
  ) {}

  /**
   * REFUSES a destination that is not actually a standalone deployment.
   *
   * Two ways it can fail to be one, and both are worth saying out loud BEFORE a single row is written.
   *
   * It still has SITES. Landing un-owned rows beside owned ones produces exactly the state that is
   * invisible to every site and cannot be keyed — rows belonging to nobody, in a database where
   * belonging to somebody is the rule.
   *
   * It still carries tenant ISOLATION. A policy checks every insert against the connection's current
   * site, and an un-owned row matches no site, so every insert is refused — one table at a time, with
   * a raw "violates row-level security policy" from whichever table came first. That is not a
   * standalone deployment yet; it is a platform that happens to have no sites, and it becomes one at
   * its next boot, when the framework releases the policies precisely because there are no sites left
   * to protect anyone from. Saying that is far more useful than the error Postgres would give.
   */
  private async refuseUnlessStandalone(): Promise<void> {
    const rows = await this.db.queryRaw('SELECT count(*)::int AS tenants FROM _system_tenants');
    const tenants = Number(rows?.[0]?.tenants ?? 0);
    if (tenants > 0) {
      throw new Error(
        `Refusing to restore standalone: this deployment already has ${tenants} site(s). Rows written `
        + 'without an owner here would be readable by no site and could not be keyed. Restore into a '
        + 'deployment with no sites, or import the archive as a site instead.',
      );
    }

    if (!this.db.supportsTenantIsolation()) return;

    const policies = await this.db.tenantIsolation.listPolicies();
    if (!policies.length) return;

    const tables = [...new Set(policies.map((policy) => policy.table))];
    throw new Error(
      `Refusing to restore standalone: ${tables.length} table(s) still carry tenant isolation `
      + `(${tables.slice(0, 3).join(', ')}${tables.length > 3 ? ', …' : ''}), so every row written without `
      + 'an owner would be refused by their policies. This deployment has no sites, so booting it once '
      + 'releases that isolation — then restore into it.',
    );
  }

  async execute(reader: TenantArchiveReader, warnings: string[] = []): Promise<Record<string, number>> {
    await this.refuseUnlessStandalone();

    const remap = new TenantIdRemap();
    const inserted: Record<string, number> = {};

    await this.db.queryRaw('BEGIN');
    try {
      await new TenantImportUsers(this.db).run(reader, remap, warnings);

      // The archive's own slug disambiguates a file name already on disk. On a fresh deployment
      // nothing is taken, so this is a name it will never need — but a restore into a deployment that
      // has been used before is exactly when it does.
      const files = new TenantImportFiles(this.uploadsDir).run(reader, reader.manifest.tenant?.slug ?? 'restored', warnings);

      const installed = await TenantInstalledPluginSlugs.read(this.db);
      const tables = this.tables.filter((table) => reader.manifest.tableNames.includes(table.name));

      for (const table of tables) {
        inserted[table.name] = await this.importTable(reader, table, remap, files, installed, warnings);
      }

      await this.db.queryRaw('COMMIT');
    } catch (error) {
      await this.db.queryRaw('ROLLBACK').catch(() => undefined);
      this.logger.error('Standalone restore failed; every row was rolled back.', error);
      throw error;
    }

    return inserted;
  }

  private async importTable(
    reader: TenantArchiveReader,
    table: TenantTableDescriptor,
    remap: TenantIdRemap,
    files: TenantImportFiles,
    installedPlugins: Set<string>,
    warnings: string[],
  ): Promise<number> {
    // A null owner: this deployment has no sites, so there is no id to stamp and, on a fresh install,
    // often no column to stamp it into.
    const inserter = new TenantRowInserter(this.db, table, null, remap, files, warnings, this.transitPassphrase);
    const skipRow = TenantImportRowFilter.forTable(table, installedPlugins);

    let count = 0;
    let skipped = 0;
    let maxId = 0;

    for await (const row of reader.rows(table.name)) {
      if (skipRow(row)) {
        skipped += 1;
        continue;
      }
      const newId = await inserter.insert(row);
      if (typeof newId === 'number' && newId > maxId) maxId = newId;
      count += 1;
    }

    await inserter.finishSelfReferences();

    // The ids came in as they were, so the sequence must be moved past them or the next row created
    // here is handed one that is already taken.
    if (table.idSequence && maxId > 0) await this.db.queryRaw(TenantSql.advanceSequence(table.idSequence), [maxId]);

    if (skipped > 0) {
      warnings.push(`${skipped} row(s) of "${table.name}" were not restored: platform-level settings, or settings of a plugin this deployment does not have.`);
    }
    return count;
  }
}
