import { describe, expect, it } from 'vitest';
import { PluginIsolationIdentityService } from '@core/plugin/host/plugin-isolation-identity-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Each isolated plugin runs as its OWN user. On a fresh install every plugin was discovered before
 * any row recorded it, the number was handed out without being kept, and all of them ran as one user —
 * seen on a live stack: 24 plugins, all uid 20000, every `isolation_uid` NULL.
 */
describe('the user an isolated plugin runs as', () => {
  function database() {
    const rows = new Map<string, Record<string, unknown>>();
    return {
      rows,
      findOne: async (_table: string, where: Record<string, unknown>) => rows.get(String(where.slug)) ?? null,
      find: async () => [...rows.values()],
      update: async (_table: string, where: Record<string, unknown>, values: Record<string, unknown>) => { rows.set(String(where.slug), { ...rows.get(String(where.slug)), ...values }); },
      insert: async (_table: string, values: Record<string, unknown>) => { rows.set(String(values.slug), { ...values }); },
    };
  }

  it('gives plugins with no row yet DIFFERENT users, and keeps each one', async () => {
    const db = database();
    const identities = new PluginIsolationIdentityService(() => db);
    const [a, b, c] = await Promise.all(['alpha', 'beta', 'gamma'].map((slug) => identities.identityFor(slug)));

    expect(new Set([a.uid, b.uid, c.uid]).size).toBe(3);
    expect(a.uid).toBe(SystemConstants.PROCESS_ISOLATION.PLUGIN_UID_BASE);
    expect(db.rows.get('beta')?.isolation_uid).toBe(b.uid);
    expect((await new PluginIsolationIdentityService(() => db).identityFor('beta')).uid).toBe(b.uid);
  });
});
