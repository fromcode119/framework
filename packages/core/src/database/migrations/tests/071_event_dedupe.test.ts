import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { EventDedupeMigration } from '@core/database/migrations/071_event_dedupe';
import { SqlRenderer } from '@fromcode119/database';

describe('071_event_dedupe', () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    const db: any = { dialect: 'sqlite', execute: async (s: any) => { sqlite.exec(SqlRenderer.SQLITE.render(s).text); } };
    await new EventDedupeMigration().up(db);
  });

  it('is registered at version 71', () => {
    expect(new EventDedupeMigration().version).toBe(71);
  });

  it('creates _system_event_dedupe and lets one (scope, key, tenant) be claimed exactly once', () => {
    const names = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    expect(names).toContain('_system_event_dedupe');

    const claim = 'INSERT INTO _system_event_dedupe (scope, dedupe_key, tenant_id) VALUES (?, ?, ?)';
    sqlite.prepare(claim).run('order:completed:licensing', 'ORD-1', 'site-a');
    // Same (scope, key, tenant) → the UNIQUE index refuses the duplicate.
    expect(() => sqlite.prepare(claim).run('order:completed:licensing', 'ORD-1', 'site-a')).toThrow(/UNIQUE/i);
    // A different key, or the same key on another site, is allowed.
    expect(() => sqlite.prepare(claim).run('order:completed:licensing', 'ORD-2', 'site-a')).not.toThrow();
    expect(() => sqlite.prepare(claim).run('order:completed:licensing', 'ORD-1', 'site-b')).not.toThrow();
  });
});
