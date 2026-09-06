import path from 'path';
import { DatabaseConnectionUrls, DatabaseFactory } from '@fromcode119/database';
import {
  BackupService, SystemConstants, TenantArchiveLayout, TenantArchiveSource, TenantArchiveWriter, TenantIdentity, TenantTableCatalog,
} from '@fromcode119/core';

/**
 * Exports a SINGLE-TENANT deployment — the local `app.db`, production before adoption — into a
 * tenant archive that the Sites admin imports like any other. This is how an existing site moves
 * onto the platform (T0 §5.2, T4 §3.3).
 *
 * ```
 * node dist/cli/tenant-export.js \
 *   --database "sqlite:/app/data/app.db?mode=ro"   # or postgres://… of the single-tenant deployment
 *   --uploads /app/public/uploads                   # that deployment's uploads root
 *   --slug vselenski --host vselenskiportal.bg [--alias www.vselenskiportal.bg]…
 *   [--out /app/backups/tenants/tenant-vselenski-<ts>.tar.gz]
 *   [--platform postgres://…]                       # the DESTINATION, for the tenant-table catalog
 * ```
 *
 * The source is opened exactly as given; pass `?mode=ro` for SQLite so the export can never write
 * to it. WHICH tables are tenant data is decided by the destination platform's own catalog
 * (`--platform`, default `DATABASE_MIGRATION_URL`/`DATABASE_URL`): the source has no policies to
 * discover from, and the destination is what has to be able to hold the rows.
 */
export class TenantExportCli {
  static async main(argv: string[]): Promise<number> {
    const args = TenantExportCli.parse(argv);
    if (args.help) {
      console.log(TenantExportCli.usage());
      return 0;
    }
    const identity = TenantIdentity.from({ slug: args.slug, primaryHost: args.host, hostAliases: args.aliases, kind: 'site' }); // a pre-tenancy database is a storefront site
    const sourceUrl = TenantExportCli.required(args.database, '--database');
    const uploadsDir = path.resolve(TenantExportCli.required(args.uploads, '--uploads'));
    const platformUrl = args.platform || DatabaseConnectionUrls.migration();
    if (!platformUrl) throw new Error('No destination platform database: pass --platform or set DATABASE_MIGRATION_URL / DATABASE_URL.');
    const outputPath = args.out
      ? path.resolve(args.out)
      : path.join(BackupService.getBackupsDirectory(SystemConstants.BACKUPS.TENANTS_SUBDIR), TenantArchiveLayout.archiveName(identity.slug, new Date()));

    const platform = DatabaseFactory.create(platformUrl);
    const source = DatabaseFactory.create(sourceUrl);
    await platform.connect();
    await source.connect();

    const catalog = new TenantTableCatalog(platform);
    let tables = await catalog.byPolicy();
    if (tables.length === 0) tables = await catalog.byColumn();
    if (tables.length === 0) throw new Error('The destination platform has no tenant tables at all; boot it once so the schema exists.');
    console.log(`[tenant-export] ${tables.length} tenant table(s) according to the destination platform.`);

    const writer = new TenantArchiveWriter(TenantArchiveSource.singleTenant(source, uploadsDir), tables);
    const result = await writer.write({
      tenant: { id: identity.id, slug: identity.slug, primaryHost: identity.primaryHost, hostAliases: identity.hostAliases, state: identity.state, kind: identity.kind.value, appearance: identity.appearance },
      plugins: await TenantExportCli.activePlugins(source),
      theme: await TenantExportCli.activeTheme(source),
      outputPath,
    });

    console.log(`[tenant-export] ${result.manifest.totalRows} row(s) in ${result.manifest.tables.length} table(s), ${result.manifest.users} user(s), ${result.manifest.files.count} file(s).`);
    for (const warning of result.manifest.warnings) console.log(`[tenant-export] warning: ${warning}`);
    console.log(`[tenant-export] wrote ${result.archivePath}`);
    return 0;
  }

  private static async activePlugins(db: any): Promise<Array<{ slug: string; version: string }>> {
    if (!(await db.tableExists(SystemConstants.TABLE.PLUGINS))) return [];
    const rows = await db.queryRaw(`SELECT slug, version FROM "${SystemConstants.TABLE.PLUGINS}" WHERE state = 'active' ORDER BY slug`);
    return rows.map((row: any) => ({ slug: String(row.slug), version: String(row.version ?? '') }));
  }

  private static async activeTheme(db: any): Promise<{ slug: string; version: string; config: Record<string, unknown> | null } | null> {
    if (!(await db.tableExists(SystemConstants.TABLE.THEMES))) return null;
    const rows = await db.queryRaw(`SELECT slug, version, config FROM "${SystemConstants.TABLE.THEMES}" WHERE state = 'active' LIMIT 1`);
    const row = rows[0];
    if (!row) return null;
    let config: Record<string, unknown> | null = null;
    if (row.config && typeof row.config === 'object') config = row.config as Record<string, unknown>;
    else if (typeof row.config === 'string') {
      try { config = JSON.parse(row.config); } catch { config = null; }
    }
    return { slug: String(row.slug), version: String(row.version ?? ''), config };
  }

  private static parse(argv: string[]): { help: boolean; database: string; uploads: string; slug: string; host: string; aliases: string[]; out: string; platform: string } {
    const out = { help: false, database: '', uploads: '', slug: '', host: '', aliases: [] as string[], out: '', platform: '' };
    for (let index = 0; index < argv.length; index += 1) {
      const flag = argv[index];
      const value = argv[index + 1];
      switch (flag) {
        case '--help': case '-h': out.help = true; break;
        case '--database': out.database = String(value ?? ''); index += 1; break;
        case '--uploads': out.uploads = String(value ?? ''); index += 1; break;
        case '--slug': out.slug = String(value ?? ''); index += 1; break;
        case '--host': out.host = String(value ?? ''); index += 1; break;
        case '--alias': out.aliases.push(String(value ?? '')); index += 1; break;
        case '--out': out.out = String(value ?? ''); index += 1; break;
        case '--platform': out.platform = String(value ?? ''); index += 1; break;
        default: throw new Error(`Unknown argument "${flag}".\n${TenantExportCli.usage()}`);
      }
    }
    return out;
  }

  private static required(value: string, flag: string): string {
    if (!String(value ?? '').trim()) throw new Error(`${flag} is required.\n${TenantExportCli.usage()}`);
    return value;
  }

  private static usage(): string {
    return [
      'Usage: tenant-export --database <url> --uploads <dir> --slug <slug> --host <host> [--alias <host>]... [--out <file>] [--platform <url>]',
      '  --database  the single-tenant source; SQLite as "sqlite:/path/app.db?mode=ro" (read-only), or a postgres:// URL',
      '  --uploads   that deployment\'s uploads root (its media files are copied into the archive)',
      '  --slug      the slug the site will have on the platform',
      '  --host      its primary host; --alias for each additional host',
      '  --out       archive path (default: <backups>/tenants/tenant-<slug>-<timestamp>.tar.gz)',
      '  --platform  the destination platform database (default: DATABASE_MIGRATION_URL or DATABASE_URL)',
    ].join('\n');
  }
}
