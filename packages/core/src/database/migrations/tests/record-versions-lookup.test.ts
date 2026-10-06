import { describe, expect, it, vi } from 'vitest';
import { RecordVersionsLookupMigration } from '@core/database/migrations/062_record_versions_lookup';

/**
 * Saving a record numbered its next version by reading every version of every record. The migration adds
 * the index that makes that read find only the record's own rows.
 */
describe('record versions lookup index', () => {
  const run = async (dialect: string, columns: string[]) => {
    const statements: string[] = [];
    const db: any = {
      dialect,
      getColumns: vi.fn(async () => columns),
      execute: vi.fn(async (sql: any) => { statements.push((sql?.chunks ?? []).map((chunk: any) => String(chunk?.value ?? '')).join('')); }),
    };
    await new RecordVersionsLookupMigration().up(db);
    return statements;
  };

  it('indexes the collection, the record and the version, so the newest is the end of one short range', async () => {
    const [statement] = await run('postgres', ['id', 'ref_id', 'ref_collection', 'version']);
    expect(statement).toContain('CREATE INDEX IF NOT EXISTS idx_record_versions_lookup ON _system_record_versions');
    expect(statement).toContain('"ref_collection", "ref_id", "version"');
  });

  it('gives MySQL the prefix lengths it needs for text columns', async () => {
    const [statement] = await run('mysql', ['id']);
    expect(statement).toContain('`ref_collection`(191), `ref_id`(191)');
  });

  it('does nothing where the table does not exist, and may run beside the serving release', async () => {
    expect(await run('postgres', [])).toEqual([]);
    expect(new RecordVersionsLookupMigration().rollingSafe).toBe(true);
  });
});
