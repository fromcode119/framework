import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseFactory, Sql } from '@fromcode119/database';
import { SourcesPublishToSiteMigration } from '@core/database/migrations/061_sources_publish_to_site';

/** Migration 61 adds the publish target and outcome to an existing Sources table, once, as NULL. */
describe('SourcesPublishToSiteMigration', () => {
  const files: string[] = [];

  afterEach(() => {
    for (const file of files.splice(0)) fs.rmSync(file, { force: true });
  });

  const database = async () => {
    const file = path.join(os.tmpdir(), `fromcode-sources-publish-${Date.now()}-${Math.random()}.db`);
    files.push(file);
    const db: any = DatabaseFactory.create(`sqlite:${file}`);
    await db.connect();
    return db;
  };

  it('adds both nullable columns, and running it again changes nothing', async () => {
    const db = await database();
    await db.execute(Sql.raw('CREATE TABLE _system_sources_builds (id INTEGER PRIMARY KEY, slug TEXT)'));
    await db.insert('_system_sources_builds', { slug: 'marketplace' });

    await new SourcesPublishToSiteMigration().up(db);
    await new SourcesPublishToSiteMigration().up(db);

    const columns = (await db.getColumns('_system_sources_builds')).map((c: string) => c.toLowerCase());
    expect(columns).toEqual(expect.arrayContaining(['publish_to_site', 'last_publish']));
    const row = await db.findOne('_system_sources_builds', { slug: 'marketplace' });
    expect(row.publish_to_site ?? null).toBeNull();
    expect(row.last_publish ?? null).toBeNull();
  });

  it('does nothing when there is no Sources table', async () => {
    const db = await database();
    await expect(new SourcesPublishToSiteMigration().up(db)).resolves.toBeUndefined();
  });
});
