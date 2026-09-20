import path from 'path';
import { DatabaseConnectionUrls, DatabaseFactory } from '@fromcode119/database';
import { ProjectPaths, StandaloneImportExecutor, TenantArchiveReader, TenantTableCatalog } from '@fromcode119/core';

/**
 * Restores a site archive into a deployment that has NO sites — the platform's exit door.
 *
 * A site could always come ONTO the platform; nothing took one back off it. An archive exported from
 * a site could be produced and then consumed by nothing except another platform, which makes the
 * platform a one-way door for data that belongs to somebody else. This is the other direction.
 *
 * ```
 * node dist/cli/standalone-restore.js --archive /app/backups/tenants/tenant-<slug>-<ts>.tar.gz
 *   --database postgres://…            # the DESTINATION, a deployment with no sites
 *   [--uploads /app/public/uploads] [--execute]
 * ```
 *
 * PREVIEW IS THE DEFAULT, for the same reason the site import previews: `--execute` writes somebody's
 * whole shop, and doing that because an argument was forgotten is the most expensive possible default.
 *
 * WHICH TABLES come from the ARCHIVE, not from the destination. A site import asks the platform which
 * tables hold tenant data, discovered from its policies — a tenant-less deployment has no policies to
 * ask, and that is the whole point of it. The archive already lists what it carries, and the
 * destination is only asked to describe those tables' columns.
 *
 * The destination must have no sites, and the executor refuses otherwise: rows written with no owner
 * beside owned ones are readable by no site and cannot be keyed.
 */
export class StandaloneRestoreCli {
  static async main(argv: string[]): Promise<number> {
    const args = StandaloneRestoreCli.parse(argv);
    if (args.help) {
      console.log(StandaloneRestoreCli.usage());
      return 0;
    }

    const archivePath = path.resolve(StandaloneRestoreCli.required(args.archive, '--archive'));
    const url = args.database || DatabaseConnectionUrls.migration() || DatabaseConnectionUrls.runtime();
    if (!url) throw new Error('No destination database: pass --database or set DATABASE_MIGRATION_URL / DATABASE_URL.');
    const uploadsDir = args.uploads ? path.resolve(args.uploads) : ProjectPaths.getUploadsDir();

    const db = DatabaseFactory.create(url);
    await db.connect();
    db.markAsPlatformConnection();

    const reader = await TenantArchiveReader.open(archivePath);
    try {
      const named = reader.manifest.tables.map((table) => table.name);
      const tables = await new TenantTableCatalog(db, [], [].values()).describe(named);
      const missing = named.filter((name) => !tables.some((table) => table.name === name));

      console.log(`Archive: ${reader.manifest.tenant?.slug ?? '(unnamed)'} exported ${reader.manifest.exportedAt}`);
      console.log(`Tables in the archive: ${named.length}; this deployment has ${tables.length}.`);
      if (missing.length) {
        console.log(`NOT restorable — this deployment has no such table: ${missing.join(', ')}`);
        console.log('Boot it once so every plugin creates its schema, then restore.');
      }

      if (!args.execute) {
        const rows = reader.manifest.tables.reduce((total, table) => total + table.rows, 0);
        console.log(`\nPREVIEW. ${rows.toLocaleString()} row(s) and ${reader.manifest.users} user(s) would be restored.`);
        console.log('Nothing was written. Pass --execute to restore.');
        return missing.length ? 1 : 0;
      }

      if (missing.length) return 1;

      const warnings: string[] = [];
      const inserted = await new StandaloneImportExecutor(db, tables, uploadsDir, args.passphrase).execute(reader, warnings);

      const total = Object.values(inserted).reduce((sum, count) => sum + count, 0);
      console.log(`\nRestored ${total.toLocaleString()} row(s) across ${Object.keys(inserted).length} table(s).`);
      for (const warning of warnings) console.log(`  warning: ${warning}`);
      return 0;
    } finally {
      reader.close();
    }
  }

  private static required(value: string | null, flag: string): string {
    if (!value) throw new Error(`Missing ${flag}.`);
    return value;
  }

  private static parse(argv: string[]): { archive: string | null; database: string | null; uploads: string | null; passphrase: string | null; execute: boolean; help: boolean } {
    const args = { archive: null as string | null, database: null as string | null, uploads: null as string | null, passphrase: null as string | null, execute: false, help: false };

    for (let at = 0; at < argv.length; at++) {
      const flag = argv[at];
      const next = (): string => String(argv[++at] ?? '');
      if (flag === '--archive') args.archive = next();
      else if (flag === '--database') args.database = next();
      else if (flag === '--uploads') args.uploads = next();
      else if (flag === '--execute') args.execute = true;
      else if (flag === '--help' || flag === '-h') args.help = true;
    }

    // Read from the environment, never a flag: an argument is visible in shell history and to anyone
    // running `ps`. The same rule the export side states.
    args.passphrase = process.env.TENANT_TRANSIT_PASSPHRASE || null;
    return args;
  }

  private static usage(): string {
    return [
      'Restore a site archive into a deployment that has no sites.',
      '',
      '  --archive <path>     the archive to restore (required)',
      '  --database <url>     the destination; defaults to DATABASE_MIGRATION_URL / DATABASE_URL',
      '  --uploads <dir>      the destination uploads root',
      '  --execute            actually write; without it this only previews',
      '',
      'TENANT_TRANSIT_PASSPHRASE unseals secrets the archive carries, if it has any.',
    ].join('\n');
  }
}
