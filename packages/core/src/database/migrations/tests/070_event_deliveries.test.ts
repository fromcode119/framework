import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { EventDeliveriesMigration } from '@core/database/migrations/070_event_deliveries';
import { SqlRenderer } from '@fromcode119/database';

/** Runs the migration's SQLite branch against a real in-memory database — a migration that is only
 * string-matched can be invalid and still pass, and it runs once at boot where a failure takes the
 * install down. */
describe('070_event_deliveries', () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    const db: any = { dialect: 'sqlite', execute: async (s: any) => { sqlite.exec(SqlRenderer.SQLITE.render(s).text); } };
    await new EventDeliveriesMigration().up(db);
  });

  it('is registered at version 70', () => {
    expect(new EventDeliveriesMigration().version).toBe(70);
  });

  it('creates _system_event_deliveries with the columns the ledger writes', () => {
    const names = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    expect(names).toContain('_system_event_deliveries');
    sqlite.prepare(
      `INSERT INTO _system_event_deliveries (event, plugin_slug, tenant_id, status, attempts, payload, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('ecommerce:order:completed', 'licensing', 5, 'failed', 1, '{"orderId":9}', 'boom');
    const row: any = sqlite.prepare('SELECT * FROM _system_event_deliveries').get();
    expect(row).toMatchObject({ event: 'ecommerce:order:completed', plugin_slug: 'licensing', status: 'failed', attempts: 1 });
  });
});
