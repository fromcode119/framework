import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseFactory, Sql } from '@fromcode119/database';
import { SourcesNamespaceMigration } from '@core/database/migrations/060_sources_namespace';

/** Migration 60 adds the vendor column to an existing Sources table, once, and leaves rows as NULL. */
describe('SourcesNamespaceMigration', () => {
  const files: string[] = [];

  afterEach(() => {
    for (const file of files.splice(0)) fs.rmSync(file, { force: true });
  });

  const database = async () => {
    const file = path.join(os.tmpdir(), `fromcode-sources-ns-${Date.now()}-${Math.random()}.db`);
    files.push(file);
    const db: any = DatabaseFactory.create(`sqlite:${file}`);
    await db.connect();
    return db;
  };

  it('adds a nullable namespace column, and running it again changes nothing', async () => {
    const db = await database();
    await db.execute(Sql.raw('CREATE TABLE _system_sources_builds (id INTEGER PRIMARY KEY, slug TEXT)'));
    await db.insert('_system_sources_builds', { slug: 'finestra' });

    await new SourcesNamespaceMigration().up(db);
    await new SourcesNamespaceMigration().up(db);

    expect((await db.getColumns('_system_sources_builds')).map((c: string) => c.toLowerCase())).toContain('namespace');
    const row = await db.findOne('_system_sources_builds', { slug: 'finestra' });
    expect(row.namespace ?? null).toBeNull();
  });

  it('does nothing when there is no Sources table', async () => {
    const db = await database();
    await expect(new SourcesNamespaceMigration().up(db)).resolves.toBeUndefined();
  });
});
