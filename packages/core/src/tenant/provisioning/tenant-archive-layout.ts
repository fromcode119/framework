import path from 'path';

/**
 * Where things live inside a tenant archive. One definition, shared by the writer and the reader,
 * so the two can never disagree about a file name.
 *
 * ```
 * manifest.json
 * tables/<table>.ndjson      one row per line, column names as stored (snake_case), tenant_id omitted
 * users.ndjson               the tenant's members: account fields + the roles they hold ON this tenant
 * files/<filename>           every file a `media` row points at (uploads are flat on disk, see writer)
 * ```
 */
export class TenantArchiveLayout {
  static readonly MANIFEST = 'manifest.json';
  static readonly TABLES_DIR = 'tables';
  static readonly USERS = 'users.ndjson';
  static readonly FILES_DIR = 'files';
  static readonly EXTENSION = '.tar.gz';

  static tableFile(root: string, table: string): string {
    return path.join(root, TenantArchiveLayout.TABLES_DIR, `${table}.ndjson`);
  }

  static tableFromFile(fileName: string): string {
    return path.basename(fileName, '.ndjson');
  }

  static archiveName(slug: string, at: Date): string {
    return `tenant-${slug}-${at.toISOString().replace(/[:.]/g, '-')}${TenantArchiveLayout.EXTENSION}`;
  }
}
