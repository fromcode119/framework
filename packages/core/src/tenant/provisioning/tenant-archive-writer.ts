import fs from 'fs';
import os from 'os';
import path from 'path';
import * as tar from 'tar';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { ProjectPaths } from '@core/config/paths';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantArchiveLayout } from '@core/tenant/provisioning/tenant-archive-layout';
import { TenantArchiveManifest } from '@core/tenant/provisioning/tenant-archive-manifest';
import { TenantArchiveSource } from '@core/tenant/provisioning/tenant-archive-source';
import { TenantArchiveUsersExport } from '@core/tenant/provisioning/tenant-archive-users-export';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';
import { SecretTransitResealer } from '@core/security/secret-transit-resealer';

/**
 * Writes one tenant — or one whole single-tenant deployment — into a portable archive.
 *
 * Rows are streamed table by table into NDJSON: a 78 MB site is never one JSON string in memory.
 * Column names are written exactly as stored (snake_case), `tenant_id` omitted — the importer stamps
 * the destination tenant's id. Files are the ones `media` rows point at: uploads are FLAT on disk
 * (the storage driver's directory is fixed at boot), so "the tenant's files" is defined by its rows,
 * not by a directory.
 *
 * Which tables: the DESCRIPTORS passed in, which the caller built from the destination platform's
 * catalog. A single-tenant source has no policies to discover from, so the destination decides what
 * counts as tenant data; a table the source lacks is skipped and named in the warnings.
 */
export class TenantArchiveWriter {
  private static readonly PAGE = 500;

  constructor(
    private readonly source: TenantArchiveSource,
    private readonly tables: TenantTableDescriptor[],
    /**
     * Seals every secret in the export under this passphrase instead of leaving it under the source
     * deployment's key, which no other deployment can read. Without one the credentials still
     * travel, and still arrive unusable — the manifest then says so rather than letting an operator
     * find out from an integration that behaves as if it were never configured.
     */
    private readonly transitPassphrase: string | null = null,
  ) {}

  async write(input: {
    tenant: TenantArchiveManifest['tenant'];
    plugins: TenantArchiveManifest['plugins'];
    theme: TenantArchiveManifest['theme'];
    outputPath: string;
  }): Promise<{ archivePath: string; manifest: TenantArchiveManifest }> {
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-tenant-export-'));
    try {
      fs.mkdirSync(path.join(staging, TenantArchiveLayout.TABLES_DIR), { recursive: true });
      fs.mkdirSync(path.join(staging, TenantArchiveLayout.FILES_DIR), { recursive: true });
      const warnings: string[] = [];

      const manifest = await this.source.scoped(async () => {
        const tables: TenantArchiveManifest['tables'] = [];
        const mediaFiles = new Set<string>();
        // Collected, then said ONCE. A source running a different plugin set is missing dozens of the
        // tables this platform declares, and a line each buried every warning that meant something.
        const absent: string[] = [];
        for (const table of this.tables) {
          const written = await this.writeTable(table, staging, mediaFiles, warnings, absent);
          if (written) tables.push(written);
        }
        if (absent.length) {
          // MEANING FIRST, then the names. This was a bare list of up to seventy physical table
          // names — most of them belonging to products the source has never run — and an operator
          // reading it before replacing a live shop could not tell whether it described something
          // lost. It does not: a table the source does not have held no rows to export. Saying that
          // in the first sentence is the difference between a warning and a wall of text. The names
          // stay, because which tables they were is exactly what someone checking would want.
          warnings.push(
            `Nothing was lost: ${absent.length} of the tables this platform knows about do not exist on the `
            + `source at all, so there was nothing in them to export. They belong to plugins the source `
            + `does not run. For reference, they were: ${absent.join(', ')}.`,
          );
        }
        const users = await new TenantArchiveUsersExport(this.source).writeTo(path.join(staging, TenantArchiveLayout.USERS));
        const files = this.copyFiles(mediaFiles, staging, warnings);
        return new TenantArchiveManifest(
          TenantArchiveManifest.FORMAT_VERSION,
          new Date().toISOString(),
          TenantArchiveWriter.frameworkVersion(),
          this.source.kind,
          input.tenant,
          input.plugins,
          input.theme,
          tables,
          users,
          files,
          warnings,
          !!this.transitPassphrase,
        );
      });

      fs.writeFileSync(path.join(staging, TenantArchiveLayout.MANIFEST), JSON.stringify(manifest.toJSON(), null, 2), 'utf8');
      fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
      await tar.create({ gzip: true, file: input.outputPath, cwd: staging }, fs.readdirSync(staging));
      return { archivePath: input.outputPath, manifest };
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  }

  private async writeTable(
    table: TenantTableDescriptor,
    staging: string,
    mediaFiles: Set<string>,
    warnings: string[],
    absent: string[],
  ): Promise<TenantArchiveManifest['tables'][number] | null> {
    if (!(await this.source.db.tableExists(table.name))) {
      absent.push(table.name);
      return null;
    }
    const sourceColumns = await this.source.db.getColumns(table.name);
    const hasTenantColumn = sourceColumns.includes('tenant_id');
    const orderBy = sourceColumns.includes('id') ? 'id' : null;
    const columns = sourceColumns.filter((column) => column !== 'tenant_id');

    const out = fs.openSync(TenantArchiveLayout.tableFile(staging, table.name), 'w');
    let rows = 0;
    try {
      for (let offset = 0; ; offset += TenantArchiveWriter.PAGE) {
        const page = await this.readPage(table.name, hasTenantColumn, orderBy, offset);
        for (const row of page) {
          const clean: Record<string, unknown> = {};
          for (const column of columns) clean[column] = TenantArchiveWriter.portable(row[column]);
          if (this.transitPassphrase) {
            for (const column of columns) clean[column] = SecretTransitResealer.sealForTransit(clean[column], this.transitPassphrase);
          }
          if (table.name === SystemConstants.TABLE.MEDIA) TenantArchiveWriter.collectMediaFiles(clean, mediaFiles);
          fs.writeSync(out, `${JSON.stringify(clean)}\n`);
          rows += 1;
        }
        if (page.length < TenantArchiveWriter.PAGE) break;
      }
    } finally {
      fs.closeSync(out);
    }
    return { name: table.name, rows, columns, hasSerialId: table.hasSerialId };
  }

  private async readPage(table: string, hasTenantColumn: boolean, orderBy: string | null, offset: number): Promise<Array<Record<string, unknown>>> {
    if (this.source.isTenant) {
      const sqlText = TenantSql.selectTenantRows(table, hasTenantColumn, orderBy, TenantArchiveWriter.PAGE, offset);
      return this.source.db.queryRaw(sqlText, hasTenantColumn ? [this.source.tenantId] : []);
    }
    return this.source.db.queryRaw(TenantSql.selectUnassignedRows(table, hasTenantColumn, orderBy, TenantArchiveWriter.PAGE, offset));
  }

  /** JSON-safe: Dates as ISO strings, Buffers as base64 under a marker the reader recognises. */
  private static portable(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return { $base64: value.toString('base64') };
    return value === undefined ? null : value;
  }

  /** `media.path` is the public URL (`/uploads/<file>`); `optimized_path` a bare filename. Both are files under the uploads root. */
  private static collectMediaFiles(row: Record<string, unknown>, into: Set<string>): void {
    for (const key of ['path', 'optimized_path']) {
      const name = TenantArchiveWriter.fileNameOf(row[key]);
      if (name) into.add(name);
    }
  }

  static fileNameOf(value: unknown): string {
    const raw = CoercionUtils.toString(value);
    if (!raw || /^https?:\/\//i.test(raw)) return '';
    return path.posix.basename(raw);
  }

  /**
   * EVERY file in the uploads directory, not only the ones a media row points at.
   *
   * It used to copy exactly `names` — the paths collected from `media` rows — and that silently lost
   * files. A site's content references images DIRECTLY by URL as well as through the library: eight
   * `vision-board-*` files were on the source disk, displayed on the live site, and named by no media
   * row at all, so a migrated shop rendered with holes where the original had pictures. The archive
   * reported "50 files" and looked complete.
   *
   * The uploads directory IS the site's files. Deciding which of them are "really" used means reading
   * every content field, every JSON blob and every theme template for URLs — the thing that cannot be
   * done reliably, and whose failure mode is losing a customer's images. Copying all of them costs
   * disk and nothing else.
   *
   * `names` is still used, for the WARNING: a media row pointing at a file that does not exist is a
   * broken record worth naming, and that check would be lost if this only walked the directory.
   */
  private copyFiles(names: Set<string>, staging: string, warnings: string[]): { count: number; bytes: number } {
    let count = 0;
    let bytes = 0;
    const destination = path.join(staging, TenantArchiveLayout.FILES_DIR);

    const present = new Set<string>();
    for (const entry of fs.existsSync(this.source.uploadsDir) ? fs.readdirSync(this.source.uploadsDir) : []) {
      const from = path.join(this.source.uploadsDir, entry);
      if (!fs.statSync(from).isFile()) continue;
      fs.copyFileSync(from, path.join(destination, entry));
      present.add(entry);
      count += 1;
      bytes += fs.statSync(from).size;
    }

    // Named one by one rather than counted: "12 files are missing" tells an operator there is a
    // problem, and which twelve tells them whether it matters.
    const missing = [...names].filter((name) => !present.has(name));
    if (missing.length) {
      warnings.push(
        `${missing.length} file(s) are referenced by a media row but missing from the uploads directory`
        + ` — the records travel, the images do not: ${missing.join(', ')}.`,
      );
    }
    return { count, bytes };
  }

  private static frameworkVersion(): string {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(ProjectPaths.getProjectRoot(), 'package.json'), 'utf8')) as { version?: string };
      return String(pkg.version || '');
    } catch {
      return '';
    }
  }
}
