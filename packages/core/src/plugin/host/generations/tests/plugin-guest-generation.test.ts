import { describe, expect, it } from 'vitest';
import { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';
import { PluginHost } from '@core/plugin/host/plugin-host';

const quietLogger: any = { info() {}, warn() {}, error() {}, debug() {} };
const generation = (number: number, channel: Record<string, unknown>, killed: number[] = []) =>
  new PluginGuestGeneration(number, { pid: number, socketDir: `/tmp/probe.${number}`, kill: () => killed.push(number) } as any, Object.assign(channel, { isClosed: false, close() {}, request: async () => undefined }, { pendingCount: channel.pendingCount ?? 0 }) as any);

describe('PluginGuestGeneration', () => {
  it('gives every process of a plugin its own id, so two can run side by side', () => {
    expect(PluginGuestGeneration.guestId('finance', 1)).toBe('plugin-finance.1');
    expect(PluginGuestGeneration.guestId('finance', 2)).not.toBe(PluginGuestGeneration.guestId('finance', 1));
  });

  it('drains only once nothing is in flight — no pending message, no HTTP request being served', async () => {
    const channel = { pendingCount: 1 };
    const current = generation(1, channel);
    let http = 1;
    setTimeout(() => { channel.pendingCount = 0; }, 60);
    setTimeout(() => { http = 0; }, 120);
    const started = Date.now();
    expect(await current.drain(() => http, 2_000)).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(100);
  });

  it('gives up draining at the deadline, and says so', async () => {
    const stuck = generation(1, { pendingCount: 1 });
    expect(await stuck.drain(() => 0, 120)).toBe(false);
  });
});

describe('PluginHost.relaunch when the replacement fails', () => {
  it('keeps the current process serving and retires the one that failed', async () => {
    const killed: number[] = [];
    const current = generation(1, { label: 'current' }, killed);
    const failing = generation(2, { label: 'failing' }, killed);
    const host = Object.create(PluginHost.prototype) as any;
    Object.assign(host, {
      guest: current.guest, channel: current.channel, generation: current, context: {}, wasEnabled: false,
      registrations: { resetForRestart() { throw new Error('must not switch'); } },
      launchGeneration: async () => failing,
      invoke: async () => { throw new Error('onInit threw'); },
      logger: quietLogger,
    });

    await expect(host.relaunch()).rejects.toThrow('onInit threw');
    expect(host.channel).toBe(current.channel);
    expect(host.generation).toBe(current);
    expect(killed).toEqual([2]);
  });
});
