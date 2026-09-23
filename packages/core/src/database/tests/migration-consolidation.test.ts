import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseFactory } from '@fromcode119/database';
import { MigrationManager } from '@core/database/migration-manager';
import { MigrationLoader } from '@core/database/migrations';
import { MigrationConsolidationGuard } from '@core/database/migration-consolidation-guard';
import { InitialFrameworkMigration } from '@core/database/migrations/001_core_initial_schema';
import { PeopleIdentityMigration } from '@core/database/migrations/009_people_identity_schema';
import { SystemDeliveryRecordsMigration } from '@core/database/migrations/011_system_delivery_records';
import { FileSharesAndGrantsMigration } from '@core/database/migrations/015_file_shares_and_grants';
import { MultiSitePlatformMigration } from '@core/database/migrations/019_multi_site_platform';
import { SourcesMigration } from '@core/database/migrations/031_sources';
import { SiteLifecycleMigration } from '@core/database/migrations/039_site_lifecycle';
import { CertificatesMigration } from '@core/database/migrations/040_certificates';
import { SiteOwnedDataMigration } from '@core/database/migrations/045_site_owned_data';
import { SourcesTableOnSqliteMigration } from '@core/database/migrations/053_sources_table_on_sqlite';

/** `MigrationLoader` requires compiled files at runtime; under vitest the set is handed over directly. */
const MIGRATIONS = [
  new InitialFrameworkMigration(), new PeopleIdentityMigration(), new SystemDeliveryRecordsMigration(),
  new FileSharesAndGrantsMigration(), new MultiSitePlatformMigration(), new SourcesMigration(),
  new SiteLifecycleMigration(), new CertificatesMigration(), new SiteOwnedDataMigration(),
  new SourcesTableOnSqliteMigration(),
];

/** The consolidated nine, then everything written after the consolidation. */
const VERSIONS = [1, 9, 11, 15, 19, 31, 39, 40, 45, 53];

/**
 * Framework migrations 1–52 were consolidated into nine. Each keeps the number of one version it
 * replaced, and these pin the three situations a database can be in when it meets them: fresh, fully
 * migrated, or stopped part-way — the one that must be refused rather than silently half-applied.
 *
 * That a fresh install comes out IDENTICAL to one built by the old 52 was proven separately, on
 * PostgreSQL, SQLite and MariaDB, by diffing the schema and seed data of both; this runs on SQLite so
 * the fresh path is exercised on every CI run.
 */
describe('consolidated framework migrations', () => {
  const files: string[] = [];

  beforeEach(() => {
    vi.spyOn(MigrationLoader, 'load').mockReturnValue(MIGRATIONS as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const file of files.splice(0)) fs.rmSync(file, { force: true });
  });

  const freshDatabase = async () => {
    const file = path.join(os.tmpdir(), `fromcode-consolidation-${Date.now()}-${Math.random()}.db`);
    files.push(file);
    const db: any = DatabaseFactory.create(`sqlite:${file}`);
    await db.connect();
    return db;
  };

  const recordVersions = async (db: any, versions: number[]) => {
    await db.ensureMigrationTable('_system_migrations');
    for (const version of versions) {
      await db.insert('_system_migrations', { name: `migration ${version}`, version, batch: 1 });
    }
  };

  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  it('ships the nine consolidated migrations, each at a version the range already had, then 53 onwards', () => {
    const dir = path.join(__dirname, '..', 'migrations');
    const shipped = fs.readdirSync(dir).filter((file) => /^\d{3}_[a-z0-9_]+\.ts$/.test(file));
    expect(shipped.map((file) => Number(file.slice(0, 3)))).toEqual(VERSIONS);
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual(VERSIONS);
  });

  it('builds a fresh install in one pass', async () => {
    const db = await freshDatabase();

    await new MigrationManager(db).migrate();

    const recorded = await db.find('_system_migrations', {});
    expect(recorded.map((row: any) => Number(row.version))).toEqual(VERSIONS);
    for (const table of ['_system_plugins', '_system_tenants', '_system_sources_builds', '_system_certificates', 'people']) {
      expect(await db.tableExists(table)).toBe(true);
    }
    expect(await db.findOne('_system_roles_permissions', { role_slug: 'admin', permission_name: 'system:deploy:restart' })).toBeTruthy();
  });

  it('runs none of the consolidated migrations on a database that already ran 1–52', async () => {
    const db = await freshDatabase();
    await recordVersions(db, range(1, 52));

    await new MigrationManager(db).migrate();

    // Only what came after the consolidation runs; nothing consolidated re-creates a table.
    expect(await db.tableExists('_system_plugins')).toBe(false);
    const recorded = await db.find('_system_migrations', {});
    expect(recorded.map((row: any) => Number(row.version)).filter((version: number) => version > 52)).toEqual([53]);
  });

  it('refuses a database that stopped part-way, before running anything', async () => {
    const db = await freshDatabase();
    await recordVersions(db, range(1, 30));

    await expect(new MigrationManager(db).migrate()).rejects.toThrow(/stopped at framework migration 30/);
    expect(await db.tableExists('_system_plugins')).toBe(false);
  });

  it('judges only framework migrations — a plugin migration says nothing about the framework schema', () => {
    expect(() => MigrationConsolidationGuard.assertComplete([{ name: 'plugin:alpha:1', version: 3 }])).not.toThrow();
    expect(() => MigrationConsolidationGuard.assertComplete([])).not.toThrow();
    expect(() => MigrationConsolidationGuard.assertComplete([{ name: 'x', version: 52 }, { name: 'y', version: 53 }])).not.toThrow();
  });
});
