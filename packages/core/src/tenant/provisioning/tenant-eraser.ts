import fs from 'fs';
import path from 'path';
import type { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantArchiveWriter } from '@core/tenant/provisioning/tenant-archive-writer';
import { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Deletes one tenant and everything that is only its: rows in every tenant table, the files its
 * media rows point at, its memberships and configuration, its registry row.
 *
 * The caller has ALREADY written an export — the eraser takes the archive path and refuses to run
 * without one. Once row-level security is on there is no partial rollback (T0 §5.2); the archive is
 * what "undo" means, so it is not optional and it is not this class's decision.
 *
 * Deletion runs inside `withTenant(id)` on the owner connection: `DELETE … WHERE tenant_id = $1`
 * with RLS `USING` scoping the same rows — belt and braces around the most destructive statement in
 * the platform. Tables go in REVERSE dependency order so children leave before parents. Accounts are
 * not touched: a person may belong to other sites.
 */
export class TenantEraser {
  private readonly logger = new Logger({ namespace: 'tenant-eraser' });

  constructor(
    private readonly db: IDatabaseManager,
    private readonly registry: TenantRegistryService,
    private readonly tables: TenantTableDescriptor[],
    private readonly uploadsDir: string,
  ) {}

  async erase(tenant: TenantRecord, exportedTo: string): Promise<{ deleted: Record<string, number>; files: number }> {
    if (!exportedTo || !fs.existsSync(exportedTo)) {
      throw new Error(`Refusing to delete tenant "${tenant.slug}": no export archive exists at "${exportedTo}".`);
    }
    const deleted: Record<string, number> = {};
    let files: string[] = [];

    await this.db.withTenant(tenant.id, async () => {
      files = await this.mediaFileNames(tenant.id);
      await this.db.queryRaw('BEGIN');
      try {
        for (const table of [...this.tables].reverse()) {
          if (!table.hasTenantColumn) continue;
          const before = await this.db.queryRaw(TenantSql.countTenantRows(table.name), [tenant.id]);
          await this.db.queryRaw(TenantSql.deleteTenantRows(table.name), [tenant.id]);
          deleted[table.name] = Number(before[0]?.count ?? 0);
        }
        await this.db.queryRaw('COMMIT');
      } catch (error) {
        await this.db.queryRaw('ROLLBACK').catch(() => undefined);
        throw error;
      }
    });

    const removedFiles = this.removeFiles(files);
    await this.registry.remove(tenant.id);
    this.logger.warn(`Tenant "${tenant.slug}" (${tenant.id}) erased: ${Object.values(deleted).reduce((a, b) => a + b, 0)} rows, ${removedFiles} files. Export: ${exportedTo}`);
    return { deleted, files: removedFiles };
  }

  private async mediaFileNames(tenantId: string): Promise<string[]> {
    const media = this.tables.find((table) => table.name === SystemConstants.TABLE.MEDIA);
    if (!media) return [];
    const rows = await this.db.queryRaw(
      `SELECT path, optimized_path FROM ${TenantSql.identifier(SystemConstants.TABLE.MEDIA)} WHERE tenant_id = $1`, [tenantId],
    );
    const names = new Set<string>();
    for (const row of rows) {
      for (const key of ['path', 'optimized_path']) {
        const name = TenantArchiveWriter.fileNameOf(row[key]);
        if (name) names.add(name);
      }
    }
    return [...names];
  }

  /** Only files this tenant's rows pointed at; a name another tenant's row also uses is left alone. */
  private removeFiles(names: string[]): number {
    let removed = 0;
    for (const name of names) {
      const target = path.join(this.uploadsDir, path.posix.basename(name));
      if (!fs.existsSync(target)) continue;
      fs.rmSync(target, { force: true });
      removed += 1;
    }
    return removed;
  }
}
