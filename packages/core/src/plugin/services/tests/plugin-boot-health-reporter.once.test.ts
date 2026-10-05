import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginBootHealthReporter } from '@core/plugin/services/runtime/plugin-boot-health-reporter';
import { PluginHealthAlertMemory } from '@core/plugin/services/health/plugin-health-alert-memory';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

const held = (slug: string, reason = PluginHeldReason.AWAITING_APPROVAL) =>
  [slug, { manifest: { slug, capabilities: [] }, state: PluginState.INACTIVE, healthStatus: PluginRegistryHealth.WARNING, heldReason: reason }] as const;
const healthy = (slug: string) =>
  [slug, { manifest: { slug, capabilities: [] }, state: PluginState.ACTIVE, healthStatus: PluginRegistryHealth.HEALTHY }] as const;

/** A `_system_meta` that keeps rows in memory, with the calls the memory makes. */
const fakeDb = (failRead = false) => {
  const rows = new Map<string, any>();
  return {
    rows,
    findOne: async (_table: string, where: { key: string }) => {
      if (failRead) throw new Error('no such table');
      return rows.get(where.key) ?? null;
    },
    update: async (_table: string, where: { key: string }, patch: any) => { rows.set(where.key, { ...rows.get(where.key), ...patch }); },
    insert: async (_table: string, row: any) => { rows.set(row.key, row); },
    withPlatformAdmin: async (fn: () => Promise<unknown>) => fn(),
  };
};

const boot = (plugins: Array<readonly [string, any]>, db = fakeDb()) => {
  const notifyAdmins = vi.fn(async () => undefined);
  vi.spyOn(NotificationsContextProxy, 'createNotificationsProxy').mockReturnValue({ notifyAdmins } as any);
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const manager: any = { plugins: new Map(plugins), db };
  return { notifyAdmins, logger, db, run: () => new PluginBootHealthReporter(manager, logger as any).reportBootPluginHealth() };
};

describe('PluginBootHealthReporter alerts once per change', () => {
  afterEach(() => vi.restoreAllMocks());

  it('alerts on the first boot with a held plugin and not on the next boot with the same one', async () => {
    const db = fakeDb();
    const first = boot([held('alpha'), healthy('beta')], db);
    await first.run();
    expect(first.notifyAdmins).toHaveBeenCalledTimes(1);

    const second = boot([held('alpha'), healthy('beta')], db);
    await second.run();
    expect(second.notifyAdmins).not.toHaveBeenCalled();
  });

  it('alerts again when another plugin is held, or the reason changes', async () => {
    const db = fakeDb();
    await boot([held('alpha')], db).run();

    const added = boot([held('alpha'), held('gamma')], db);
    await added.run();
    expect(added.notifyAdmins).toHaveBeenCalledTimes(1);

    const reason = boot([held('alpha', PluginHeldReason.CAPABILITY_DRIFT), held('gamma')], db);
    await reason.run();
    expect(reason.notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it('forgets once everything is healthy, so a plugin held again later is reported again', async () => {
    const db = fakeDb();
    await boot([held('alpha')], db).run();
    const recovered = boot([healthy('alpha')], db);
    await recovered.run();
    expect(recovered.notifyAdmins).not.toHaveBeenCalled();

    const again = boot([held('alpha')], db);
    await again.run();
    expect(again.notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it('still alerts when the memory cannot be read', async () => {
    const run = boot([held('alpha')], fakeDb(true));
    await run.run();
    expect(run.notifyAdmins).toHaveBeenCalledTimes(1);
  });
});

describe('PluginHealthAlertMemory.fingerprint', () => {
  it('does not depend on the order of the plugins', () => {
    const a = { count: 2, plugins: [{ slug: 'a', held: true }, { slug: 'b', held: false, error: 'boom' }] };
    const b = { count: 2, plugins: [{ slug: 'b', held: false, error: 'boom' }, { slug: 'a', held: true }] };
    expect(PluginHealthAlertMemory.fingerprint(a)).toBe(PluginHealthAlertMemory.fingerprint(b));
  });
});
