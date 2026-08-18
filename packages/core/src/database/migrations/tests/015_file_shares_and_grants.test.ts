import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { FileSharesAndGrantsMigration } from '@core/database/migrations/015_file_shares_and_grants';

/**
 * Runs the migration's SQLite branch against a real in-memory database rather than asserting on
 * captured strings. A migration that is only string-matched can be syntactically invalid and still
 * pass — and migrations run once, at boot, where a failure takes the install down.
 */
describe('015_file_shares_and_grants', () => {
  let sqlite: InstanceType<typeof Database>;
  let executed: string[];
  let db: any;

  /** `sql.raw('X')` stores the text at queryChunks[0].value[0]; the migration uses raw for SQLite. */
  const textOf = (statement: any): string => String(statement?.queryChunks?.[0]?.value?.[0] ?? '');

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    executed = [];
    db = {
      dialect: 'sqlite',
      execute: async (statement: any) => {
        const text = textOf(statement);
        executed.push(text);
        sqlite.exec(text);
      },
    };
    await new FileSharesAndGrantsMigration().up(db);
  });

  it('is registered at version 15', () => {
    const migration = new FileSharesAndGrantsMigration();
    expect(migration.version).toBe(15);
    expect(migration.name).toMatch(/file/i);
  });

  it('creates all three tables', () => {
    const names = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r: any) => r.name);
    expect(names).toEqual(expect.arrayContaining([
      '_system_file_shares', '_system_file_grants', '_system_file_access_log',
    ]));
  });

  it('enforces one grant per token hash', () => {
    // The index is the reason a token lookup is safe to do by hash alone. Collection-declared indexes
    // are only logged by SchemaManager, never created — so if this is not in the migration, it does
    // not exist anywhere.
    const insert = 'INSERT INTO _system_file_grants (share_id, email, token_hash) VALUES (1, ?, ?)';
    sqlite.prepare(insert).run('a@b.c', 'hash-one');
    expect(() => sqlite.prepare(insert).run('other@b.c', 'hash-one')).toThrow(/UNIQUE/i);
    expect(() => sqlite.prepare(insert).run('other@b.c', 'hash-two')).not.toThrow();
  });

  it('defaults a new grant to unlimited and unrevoked', () => {
    sqlite.prepare('INSERT INTO _system_file_grants (share_id, email, token_hash) VALUES (1, ?, ?)').run('a@b.c', 'h');
    const row: any = sqlite.prepare('SELECT * FROM _system_file_grants WHERE token_hash = ?').get('h');

    // 0 = unlimited is the model-wide convention; the column default has to agree with it.
    expect(row.max_downloads).toBe(0);
    expect(row.download_count).toBe(0);
    expect(row.expires_at).toBeNull();
    expect(row.revoked_at).toBeNull();
    expect(row.require_confirmation).toBe(0);
    expect(row.require_account).toBe(0);
  });

  it('defaults a share to an empty file list rather than NULL', () => {
    sqlite.prepare('INSERT INTO _system_file_shares (title) VALUES (?)').run('Handbook');
    const row: any = sqlite.prepare('SELECT * FROM _system_file_shares').get();
    expect(JSON.parse(row.media_ids)).toEqual([]);
  });

  it('is safe to run twice', () => {
    // The runner records executed migrations, but CREATE ... IF NOT EXISTS is what makes a partially
    // applied migration recoverable rather than fatal on the next boot.
    expect(async () => new FileSharesAndGrantsMigration().up(db)).not.toThrow();
  });

  it('logs an attempt that matched no grant', () => {
    // The case the unit tests could not reach and a live request found immediately: an unknown token
    // has no grant to reference. A NOT NULL here threw, turning the deliberately-generic refusal into
    // a 500 — which itself distinguished "no such token" from every other refusal.
    expect(() => sqlite
      .prepare('INSERT INTO _system_file_access_log (grant_id, media_id, outcome, ip) VALUES (NULL, NULL, ?, ?)')
      .run('unknown', '1.2.3.4')).not.toThrow();

    const row: any = sqlite.prepare('SELECT * FROM _system_file_access_log').get();
    expect(row.grant_id).toBeNull();
    expect(row.outcome).toBe('unknown');
  });

  it('creates every index in the same branch as the tables', () => {
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_file%'")
      .all()
      .map((r: any) => r.name);
    expect(indexes).toEqual(expect.arrayContaining([
      'idx_file_grants_token_hash', 'idx_file_grants_share', 'idx_file_grants_email', 'idx_file_access_log_grant',
    ]));
  });
});
