import path from 'path';
import { DatabaseConnectionUrls, DatabaseFactory } from '@fromcode119/database';
import {
  ProjectPaths, SystemConstants, TenantArchiveReader, TenantImportExecutor, TenantImportIdentity,
  TenantImportPlan, TenantImportPlanner, TenantRegistryService, TenantResolverService, TenantTableCatalog,
} from '@fromcode119/core';

/**
 * Imports a tenant archive from a PATH on the server, without a browser.
 *
 * The Sites admin can already do this, but only from an upload session: preview and execute resolve
 * an `uploadId` that a browser created, so a scripted refresh — export the live shop, rebuild the
 * staging site, compare row counts — could not close its loop. The migration runbook's `swap` stage
 * says exactly that, and refuses to pretend otherwise.
 *
 * ```
 * node dist/cli/tenant-import.js --archive /app/backups/tenants/tenant-vsp88-<ts>.tar.gz
 *   [--slug vsp88] [--host vsp88.example] [--alias www.vsp88.example] [--environment production]
 *   [--platform postgres://…] [--uploads /app/public/uploads] [--json] [--execute]
 * ```
 *
 * PREVIEW IS THE DEFAULT and `--execute` is the only way to write anything. An import creates a site
 * and inserts every row of somebody's real shop; a CLI that did that because an argument was
 * forgotten would be the most expensive possible default. Preview prints the same plan the admin
 * shows — what would be remapped, which plugins are missing, what blocks it — and exits non-zero
 * when the plan cannot execute, so a script can stop on it.
 *
 * Identity, including the rule that AN IMPORT ARRIVES MUTED, is resolved by `TenantImportIdentity`,
 * the same code the HTTP path uses. This CLI does not get its own opinion about that.
 */
export class TenantImportCli {
  static async main(argv: string[]): Promise<number> {
    const args = TenantImportCli.parse(argv);
    if (args.help) {
      console.log(TenantImportCli.usage());
      return 0;
    }

    const archivePath = path.resolve(TenantImportCli.required(args.archive, '--archive'));
    const platformUrl = args.platform || DatabaseConnectionUrls.migration() || DatabaseConnectionUrls.runtime();
    if (!platformUrl) throw new Error('No platform database: pass --platform or set DATABASE_MIGRATION_URL / DATABASE_URL.');
    const uploadsDir = args.uploads ? path.resolve(args.uploads) : ProjectPaths.getUploadsDir();

    const db = DatabaseFactory.create(platformUrl);
    await db.connect();
    db.markAsPlatformConnection();

    const reader = await TenantArchiveReader.open(archivePath);
    try {
      const identity = TenantImportIdentity.resolve(
        reader.manifest.tenant as unknown as Record<string, unknown>,
        TenantImportCli.overrides(args),
      );
      const registry = new TenantRegistryService(db, TenantResolverService.shared(db));

      // WHICH tables hold tenant data is the platform's own answer, discovered from its policies —
      // the same source the export CLI uses. There are no registered collections in a CLI process
      // (no plugin host is running), and there need not be: the catalog enriches with them when a
      // server has them and discovers the rest from the database either way.
      const tables = await new TenantTableCatalog(db).byPolicy();
      if (tables.length === 0) throw new Error('This platform has no tenant tables at all; boot it once so the schema exists.');

      const planner = new TenantImportPlanner(db, registry, tables, await TenantImportCli.installed(db), uploadsDir);
      const plan = await planner.plan(reader, identity);

      TenantImportCli.report(plan, args.json);
      if (!plan.canExecute) {
        console.error(`[tenant-import] ${plan.blockers.length} blocker(s): nothing was imported.`);
        return 1;
      }
      if (!args.execute) {
        console.log('[tenant-import] preview only — pass --execute to import.');
        return 0;
      }

      const result = await new TenantImportExecutor(db, registry, tables, uploadsDir).execute(reader, identity, plan);
      console.log(`[tenant-import] imported "${result.tenant.slug}": ${result.totalRows} row(s), ${result.remappedTables.length} table(s) re-numbered.`);
      console.log(`[tenant-import] the site arrives ${identity.environment} and private — publish it from Sites when you mean to.`);
      return 0;
    } finally {
      reader.close();
    }
  }

  /**
   * What this platform already has, for the plan's compatibility section.
   *
   * Read from the DATABASE rather than a plugin manager: a CLI runs no plugin host, and the rows are
   * what a running server would have loaded anyway.
   */
  private static async installed(db: any): Promise<{ plugins: Map<string, string>; themes: Map<string, string> }> {
    const plugins = new Map<string, string>();
    const themes = new Map<string, string>();
    if (await db.tableExists(SystemConstants.TABLE.PLUGINS)) {
      for (const row of await db.queryRaw(`SELECT slug, version FROM "${SystemConstants.TABLE.PLUGINS}"`)) {
        plugins.set(String(row.slug), String(row.version ?? ''));
      }
    }
    if (await db.tableExists(SystemConstants.TABLE.THEMES)) {
      for (const row of await db.queryRaw(`SELECT slug, version FROM "${SystemConstants.TABLE.THEMES}"`)) {
        themes.set(String(row.slug), String(row.version ?? ''));
      }
    }
    return { plugins, themes };
  }

  /** The plan, in the terms the admin screen states it — blockers last, because they are the answer. */
  private static report(plan: TenantImportPlan, asJson: boolean): void {
    if (asJson) {
      console.log(JSON.stringify(plan.toJSON(), null, 2));
      return;
    }
    const rows = plan.tables.reduce((sum, table) => sum + table.rows, 0);
    console.log(`[tenant-import] ${rows} row(s) across ${plan.tables.length} table(s); ${plan.users.toCreate} new user(s) of ${plan.users.total}; ${plan.files.count} file(s).`);
    if (plan.remappedTables.length > 0) {
      console.log(`[tenant-import] re-numbered on import: ${plan.remappedTables.join(', ')}`);
    }
    for (const plugin of plan.plugins.filter((entry) => !entry.installedVersion)) {
      console.log(`[tenant-import] plugin not installed here: ${plugin.slug} (archive ${plugin.archiveVersion})`);
    }
    for (const warning of plan.warnings) console.log(`[tenant-import] warning: ${warning}`);
    for (const blocker of plan.blockers) console.error(`[tenant-import] BLOCKER: ${blocker}`);
  }

  /** Only what was actually passed: an absent flag must mean "use the archive", never "clear it". */
  private static overrides(args: ReturnType<typeof TenantImportCli.parse>): Record<string, unknown> {
    const input: Record<string, unknown> = {};
    if (args.slug) input.slug = args.slug;
    if (args.host) input.primaryHost = args.host;
    if (args.aliases.length > 0) input.hostAliases = args.aliases;
    if (args.kind) input.kind = args.kind;
    if (args.environment) input.environment = args.environment;
    if (args.visibility) input.visibility = args.visibility;
    return input;
  }

  private static parse(argv: string[]) {
    const out = {
      help: false, execute: false, json: false, archive: '', slug: '', host: '',
      aliases: [] as string[], kind: '', environment: '', visibility: '', platform: '', uploads: '',
    };
    for (let index = 0; index < argv.length; index += 1) {
      const flag = argv[index];
      const value = argv[index + 1];
      switch (flag) {
        case '--help': case '-h': out.help = true; break;
        case '--execute': out.execute = true; break;
        case '--json': out.json = true; break;
        case '--archive': out.archive = String(value ?? ''); index += 1; break;
        case '--slug': out.slug = String(value ?? ''); index += 1; break;
        case '--host': out.host = String(value ?? ''); index += 1; break;
        case '--alias': out.aliases.push(String(value ?? '')); index += 1; break;
        case '--kind': out.kind = String(value ?? ''); index += 1; break;
        case '--environment': out.environment = String(value ?? ''); index += 1; break;
        case '--visibility': out.visibility = String(value ?? ''); index += 1; break;
        case '--platform': out.platform = String(value ?? ''); index += 1; break;
        case '--uploads': out.uploads = String(value ?? ''); index += 1; break;
        default: throw new Error(`Unknown argument "${flag}".\n${TenantImportCli.usage()}`);
      }
    }
    return out;
  }

  private static required(value: string, flag: string): string {
    if (!String(value ?? '').trim()) throw new Error(`${flag} is required.\n${TenantImportCli.usage()}`);
    return value;
  }

  private static usage(): string {
    return [
      'Usage: tenant-import --archive <file> [--execute] [--slug <slug>] [--host <host>] [--alias <host>]...',
      '                    [--kind site|workspace] [--environment production] [--visibility public]',
      '                    [--platform <url>] [--uploads <dir>] [--json]',
      '  --archive      the tenant archive to import',
      '  --execute      actually import; WITHOUT it this only previews the plan and writes nothing',
      '  --slug/--host  override the archive\'s own identity; omit to keep what it was exported as',
      '  --environment  an import arrives NON-PRODUCTION; pass "production" for a real migration',
      '  --visibility   an import arrives PRIVATE; publishing is a separate, deliberate act',
      '  --platform     the destination platform database (default: DATABASE_MIGRATION_URL or DATABASE_URL)',
      '  --uploads      the platform uploads root (default: the project\'s own)',
      '  --json         print the full plan as JSON instead of a summary',
      '',
      'Exit codes: 0 fine, 1 the plan has blockers and nothing was imported.',
    ].join('\n');
  }
}
