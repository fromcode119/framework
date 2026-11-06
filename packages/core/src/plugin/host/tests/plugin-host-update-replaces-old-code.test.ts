import { describe, expect, it, vi } from 'vitest';
import { PluginHost } from '@core/plugin/host/plugin-host';

/**
 * An operator's update whose new process fails to start must not leave the OLD code serving. On TPS
 * (2026-11-06) ecommerce 0.1.376's `onInit` timed out, the replacement was retired, and the 0.1.375 process
 * answered every request — while the admin showed 0.1.376 — until the extension-host was restarted by hand.
 */
describe('a plugin update whose new code does not start', () => {
  const hostWith = (relaunch: () => Promise<void>) => {
    const killed: string[] = [];
    const closed: string[] = [];
    const host = Object.create(PluginHost.prototype) as any;
    const old = { pid: 116, kill: (signal: string) => killed.push(signal) };
    const channel = { isClosed: false, close: () => { closed.push('old'); channel.isClosed = true; } };
    Object.assign(host, {
      slug: 'ecommerce', manifest: { version: '0.1.375' }, guest: old, channel, generation: { channel, guest: old },
      settings: { forPlugin: () => ({ memoryMb: 256, timeoutMs: 30_000 }) },
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      tokens: { revokeAll() {} }, stopping: false, restarting: false,
      relaunch: vi.fn(relaunch),
      restart: vi.fn(async () => undefined),
    });
    return { host, killed, closed };
  };

  it('stops the process running the old code and restarts the plugin on the new files', async () => {
    const { host, killed, closed } = hostWith(async () => { throw new Error('invoke timed out after 60000ms without any activity'); });

    await expect(host.reload({ version: '0.1.376' })).rejects.toThrow('invoke timed out');

    expect(killed).toEqual(['SIGKILL']);
    expect(closed).toEqual(['old']);
    expect(host.guest).toBeNull();
    expect(host.channel).toBeNull();
    expect(host.restart).toHaveBeenCalledWith(expect.stringContaining('could not start its updated code'));
    expect(host.restarting).toBe(false);
  });

  it('leaves a successful update alone', async () => {
    const { host, killed } = hostWith(async () => undefined);

    await host.reload({ version: '0.1.376' });

    expect(killed).toEqual([]);
    expect(host.restart).not.toHaveBeenCalled();
    expect(host.restarting).toBe(false);
  });
});
