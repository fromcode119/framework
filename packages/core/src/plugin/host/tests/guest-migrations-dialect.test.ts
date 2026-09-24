import { describe, expect, it, vi } from 'vitest';
import { PluginGuestContextFactory } from '@core/plugin/host/plugin-guest-context-factory';

/**
 * An ISOLATED plugin's migration must see the database dialect as the string it is.
 *
 * The migration's `db` forwards every property to the host as a call, so `db.dialect` came back as a
 * FUNCTION: `db.dialect !== 'postgres'` was always true, and every Postgres-only migration step of
 * every isolated plugin returned before doing anything — silently, with the migration reported run.
 */
const guestMigrations = (hostDialect: string) => {
  const remote = {
    call: vi.fn(async (_root: string, steps: Array<{ name: string; args?: unknown[] }>) => (
      steps[0]?.name === 'dialect' && !steps[0]?.args ? hostDialect : undefined
    )),
    ref: vi.fn(),
  };
  const factory = Object.create(PluginGuestContextFactory.prototype);
  Object.assign(factory, {
    remote,
    handlers: { keep: vi.fn(() => 'handler-1') },
    channel: {}, http: {}, state: {}, boot: {},
    scheduler: () => ({}),
    registerTools: vi.fn(),
  });
  const context: any = factory.create.call(factory);
  return { migrations: context.migrations, remote };
};

describe('isolated guest context.migrations', () => {
  it("hands a migration the host's dialect as a string", async () => {
    const { migrations } = guestMigrations('postgres');
    let seen: unknown;
    await migrations.run([{ up: async (db: any) => { seen = db.dialect; } }]);
    expect(seen).toBe('postgres');
  });

  it('still forwards statements to the host', async () => {
    const { migrations, remote } = guestMigrations('postgres');
    await migrations.run([{ up: async (db: any) => { if (db.dialect === 'postgres') await db.execute('SELECT 1'); } }]);
    expect(remote.call).toHaveBeenCalledWith('ddl', [expect.objectContaining({ name: 'execute' })]);
  });
});
