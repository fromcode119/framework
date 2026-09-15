import { describe, it, expect, vi } from 'vitest';
import { TenantOwnedArtifactsMigration } from '@core/database/migrations/045_tenant_owned_artifacts';

/**
 * `owner_tenant_id` must be ADDITIVE. Every row that exists when this runs is the platform's, and
 * `NULL` already means that — so a backfill would be inventing an owner, and a NOT NULL default would
 * have to name a tenant that does not exist. These tests pin that it stays nullable and untouched.
 */

/**
 * The text of a `sql.raw(...)` — it is not a string but a chunk tree, so the statements a migration
 * issues have to be read out of it rather than stringified.
 */
function sqlText(statement: any): string {
  const chunks = statement?.queryChunks;
  if (!Array.isArray(chunks)) return String(statement ?? '');
  return chunks
    .flatMap((chunk: any) => (Array.isArray(chunk?.value) ? chunk.value : [chunk?.value]))
    .filter((part: unknown) => typeof part === 'string')
    .join('');
}

/** A dialect stub that records the SQL it was handed and answers "column absent". */
function postgresDb(existingColumns: string[] = []) {
  const statements: string[] = [];
  return {
    dialect: 'postgres',
    statements,
    execute: vi.fn(async (statement: any) => {
      const text = sqlText(statement);
      statements.push(text);
      if (/information_schema\.columns/i.test(text)) {
        const named = existingColumns.some((column) => text.includes(`column_name = '${column}'`));
        return { rows: named ? [{ present: 1 }] : [] };
      }
      return { rows: [] };
    }),
  } as any;
}

const sqlOf = (db: any) => db.statements.join('\n');

describe('045_tenant_owned_artifacts', () => {
  it('is registered at version 45', () => {
    const migration = new TenantOwnedArtifactsMigration();
    expect(migration.version).toBe(45);
    expect(typeof migration.up).toBe('function');
    expect(migration.name).toMatch(/owned by one site/i);
  });

  it('adds the column to BOTH platform registries — a plugin is as ownable as a theme', async () => {
    const db = postgresDb();

    await new TenantOwnedArtifactsMigration().up(db);

    expect(sqlOf(db)).toMatch(/ALTER TABLE _system_themes ADD COLUMN IF NOT EXISTS owner_tenant_id/i);
    expect(sqlOf(db)).toMatch(/ALTER TABLE _system_plugins ADD COLUMN IF NOT EXISTS owner_tenant_id/i);
  });

  it('adds it NULLABLE, with no default and no backfill', async () => {
    const db = postgresDb();

    await new TenantOwnedArtifactsMigration().up(db);
    const sql = sqlOf(db);

    // A default would have to be a real tenant id, and there is no honest one to pick.
    expect(sql).not.toMatch(/owner_tenant_id[^;\n]*NOT NULL/i);
    expect(sql).not.toMatch(/owner_tenant_id[^;\n]*DEFAULT/i);
    // Nothing may rewrite existing rows: they are the platform's, which is what NULL already says.
    expect(sql).not.toMatch(/UPDATE _system_(themes|plugins)/i);
  });

  it('indexes it, because it is a filter on every listing rather than a lookup key', async () => {
    const db = postgresDb();

    await new TenantOwnedArtifactsMigration().up(db);

    expect(sqlOf(db)).toMatch(/CREATE INDEX IF NOT EXISTS _system_themes_owner_tenant_id_idx/i);
    expect(sqlOf(db)).toMatch(/CREATE INDEX IF NOT EXISTS _system_plugins_owner_tenant_id_idx/i);
  });

  it('is re-runnable: an existing column is left alone rather than re-added', async () => {
    const db = postgresDb(['owner_tenant_id']);

    await new TenantOwnedArtifactsMigration().up(db);

    expect(sqlOf(db)).not.toMatch(/ALTER TABLE/i);
  });

  it('asks SQLite with PRAGMA, never with information_schema, which errors there', async () => {
    const statements: string[] = [];
    const db: any = {
      dialect: 'sqlite',
      execute: vi.fn(async (statement: any) => {
        statements.push(sqlText(statement));
        return [];
      }),
    };

    await new TenantOwnedArtifactsMigration().up(db);

    expect(statements.join('\n')).toMatch(/PRAGMA table_info/i);
    expect(statements.join('\n')).not.toMatch(/information_schema/i);
  });
});
