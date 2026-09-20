import path from 'path';
import { DatabaseConnectionUrls, DatabaseFactory } from '@fromcode119/database';
import {
  BackupService, ProjectPaths, SystemConstants, TenantArchiveLayout, TenantArchiveSource,
  TenantArchiveWriter, TenantEraser, TenantRecord, TenantRegistryService, TenantResolverService,
  TenantTableCatalog,
} from '@fromcode119/core';

/**
 * Deletes a site from a shell, without a browser.
 *
 * The Sites admin can already do this, but only there — so a scripted re-sync (export the live
 * shop, rebuild the archive, import it again) could not run end to end: the import refuses while a
 * site of that id already exists, and the only way to remove it was to open the admin and click.
 * One manual step in the middle of an otherwise headless pipeline is the whole reason this exists.
 *
 * It behaves exactly like the admin's delete, because it is the same two objects underneath:
 *
 *  - **It exports first, always.** `TenantEraser` refuses to erase without an archive on disk, and
 *    that refusal is the safety net, not a formality — the archive is the only way back.
 *  - **PREVIEW IS THE DEFAULT.** Without `--execute` it reads, prints what would go, and writes
 *    nothing at all: no archive, no deletion.
 *  - **The slug must be typed.** `--confirm <slug>` has to match the site's own slug, the same
 *    confirmation the admin screen demands, so a mistyped `--id` cannot delete the wrong site.
 *
 * ```
 * node dist/cli/tenant-delete.js --id vselenskiportal88 --confirm vselenskiportal88 [--execute]
 *   [--platform postgres://…] [--uploads /app/public/uploads] [--json]
 * ```
 */
export class TenantDeleteCli {
  static async main(argv: string[]): Promise<number> {
    const args = TenantDeleteCli.parse(argv);
    if (args.help) {
      console.log(TenantDeleteCli.usage());
      return 0;
    }

    const id = TenantDeleteCli.required(args.id, '--id');
    const platformUrl = args.platform || DatabaseConnectionUrls.migration() || DatabaseConnectionUrls.runtime();
    if (!platformUrl) throw new Error('No platform database: pass --platform or set DATABASE_MIGRATION_URL / DATABASE_URL.');
    const uploadsDir = args.uploads ? path.resolve(args.uploads) : ProjectPaths.getUploadsDir();

    const db = DatabaseFactory.create(platformUrl);
    await db.connect();
    db.markAsPlatformConnection();

    const registry = new TenantRegistryService(db, TenantResolverService.shared(db));
    const tenant = await registry.get(id);
    if (!tenant) throw new Error(`No site with id "${id}" on this platform.`);

    // The typed slug is the operator's confirmation, checked BEFORE anything is read or written.
    if (String(args.confirm ?? '') !== tenant.slug) {
      throw new Error(`Refusing to delete "${tenant.slug}": pass --confirm ${tenant.slug} to confirm.`);
    }

    const tables = await new TenantTableCatalog(db, [], []).byPolicy();
    if (tables.length === 0) throw new Error('This platform has no tenant tables at all; boot it once so the schema exists.');

    if (!args.execute) {
      TenantDeleteCli.report(tenant, tables.length, args.json);
      console.log('[tenant-delete] preview only — nothing was exported and nothing was deleted. Pass --execute to delete.');
      return 0;
    }

    const archivePath = await TenantDeleteCli.exportFirst(db, tenant, tables, uploadsDir);
    console.log(`[tenant-delete] exported to ${archivePath}`);

    const outcome = await new TenantEraser(db, registry, tables, uploadsDir).erase(tenant, archivePath);
    const rows = Object.values(outcome.deleted).reduce((total, count) => total + count, 0);
    console.log(`[tenant-delete] deleted "${tenant.slug}": ${rows} row(s) across ${Object.keys(outcome.deleted).length} table(s), ${outcome.files} file(s).`);
    console.log(`[tenant-delete] the archive above is the only copy — keep it until you are sure.`);
    return 0;
  }

  /** The same archive the admin writes before erasing: full tenant export, into the backups directory. */
  private static async exportFirst(db: unknown, tenant: TenantRecord, tables: unknown[], uploadsDir: string): Promise<string> {
    const outputPath = path.join(
      BackupService.getBackupsDirectory(SystemConstants.BACKUPS.TENANTS_SUBDIR),
      TenantArchiveLayout.archiveName(tenant.slug, new Date()),
    );
    const source = TenantArchiveSource.tenant(db as never, tenant.id, uploadsDir);
    const result = await new TenantArchiveWriter(source, tables as never).write({
      tenant: {
        id: tenant.id, slug: tenant.slug, primaryHost: tenant.primaryHost, hostAliases: tenant.hostAliases,
        state: tenant.state, kind: tenant.kind.value, appearance: tenant.appearance,
      },
      plugins: [],
      theme: null,
      outputPath,
    });
    return result.archivePath;
  }

  private static report(tenant: TenantRecord, tableCount: number, json: boolean): void {
    if (json) {
      console.log(JSON.stringify({ id: tenant.id, slug: tenant.slug, primaryHost: tenant.primaryHost, tables: tableCount }, null, 2));
      return;
    }
    console.log(`[tenant-delete] site "${tenant.slug}" (${tenant.id}), host ${tenant.primaryHost}`);
    console.log(`[tenant-delete] --execute would export it, then remove its rows from ${tableCount} tenant table(s) and its uploaded files.`);
  }

  private static parse(argv: string[]) {
    const out: { help: boolean; execute: boolean; json: boolean; id: string; confirm: string; platform: string; uploads: string } = {
      help: false, execute: false, json: false, id: '', confirm: '', platform: '', uploads: '',
    };
    for (let index = 0; index < argv.length; index += 1) {
      const flag = argv[index];
      const value = argv[index + 1];
      switch (flag) {
        case '--help': case '-h': out.help = true; break;
        case '--execute': out.execute = true; break;
        case '--json': out.json = true; break;
        case '--id': out.id = String(value ?? ''); index += 1; break;
        case '--confirm': out.confirm = String(value ?? ''); index += 1; break;
        case '--platform': out.platform = String(value ?? ''); index += 1; break;
        case '--uploads': out.uploads = String(value ?? ''); index += 1; break;
        default: throw new Error(`Unknown argument "${flag}".\n${TenantDeleteCli.usage()}`);
      }
    }
    return out;
  }

  private static required(value: string, flag: string): string {
    if (!String(value ?? '').trim()) throw new Error(`${flag} is required.\n${TenantDeleteCli.usage()}`);
    return String(value).trim();
  }

  private static usage(): string {
    return [
      'Usage: tenant-delete --id <id> --confirm <slug> [--execute]',
      '                     [--platform <url>] [--uploads <dir>] [--json]',
      '',
      '  --id        the site to delete',
      '  --confirm   the site\'s own slug, typed back — required, and checked before anything happens',
      '  --execute   actually do it. WITHOUT this nothing is exported and nothing is deleted.',
      '  --platform  the platform database (default: DATABASE_MIGRATION_URL / DATABASE_URL)',
      '  --uploads   the uploads root (default: the project\'s own)',
      '',
      'The site is ALWAYS exported to the backups directory before it is erased.',
    ].join('\n');
  }
}
