import { afterEach, describe, expect, it } from 'vitest';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { SpawnerClient } from '@core/process/spawner-client';

/**
 * A deploy starts the next extension-host beside the running one. Each plugin whose process is in the
 * older host moves with the gapless relaunch; one already in the current host, or not started by a
 * spawner at all, stays exactly as it is.
 */
describe('PluginHost.moveToCurrentHost', () => {
  afterEach(() => { SpawnerClient.publish(null); });

  const hostOn = (launcher: unknown) => {
    const host = Object.create(PluginHost.prototype) as any;
    const relaunched: boolean[] = [];
    Object.assign(host, {
      slug: 'move-probe', guest: { pid: 7, launcher }, stopping: false, restarting: false,
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      relaunch: async () => { relaunched.push(host.restarting); host.guest = { pid: 8, launcher: SpawnerClient.current() }; },
    });
    return { host, relaunched };
  };

  it('moves a process that runs in an older host, as a relaunch, and not counted as a restart', async () => {
    const older = { name: 'older' };
    const newer = { name: 'newer' };
    SpawnerClient.publish(newer as any);
    const { host, relaunched } = hostOn(older);

    expect(await host.moveToCurrentHost()).toBe(true);
    expect(relaunched).toEqual([true]);
    expect(host.guest.launcher).toBe(newer);
    expect(host.restarting).toBe(false);
  });

  it('leaves a process that already runs in the current host, or that no spawner started', async () => {
    const current = { name: 'current' };
    SpawnerClient.publish(current as any);
    const inCurrent = hostOn(current);
    const forked = hostOn(null);

    expect(await inCurrent.host.moveToCurrentHost()).toBe(false);
    expect(await forked.host.moveToCurrentHost()).toBe(false);
    expect(inCurrent.relaunched).toEqual([]);
    expect(forked.relaunched).toEqual([]);
  });

  it('keeps the process it has when the move fails, and says so', async () => {
    SpawnerClient.publish({ name: 'newer' } as any);
    const { host } = hostOn({ name: 'older' });
    const warnings: string[] = [];
    host.logger = { info() {}, warn: (line: string) => warnings.push(line), error() {}, debug() {} };
    host.relaunch = async () => { throw new Error('the new host refused'); };

    expect(await host.moveToCurrentHost()).toBe(false);
    expect(warnings[0]).toContain('the new host refused');
    expect(host.restarting).toBe(false);
  });
});
