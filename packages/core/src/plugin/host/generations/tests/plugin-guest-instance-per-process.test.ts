import os from 'os';
import { describe, expect, it, vi } from 'vitest';

/**
 * Four api processes in one container all took the container's hostname as their instance. When api 0
 * crashed and came back, its generations counted from 1 again, it was handed the directory of an earlier
 * process, could not take its socket (EPERM), and the throw took the api down — in a loop.
 */
describe('the instance in a plugin process id', () => {
  it('is the same throughout one api process, and starts with the host it runs on', async () => {
    const { PluginGuestGeneration } = await import('@core/plugin/host/generations/plugin-guest-generation');
    const host = os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 12);
    expect(PluginGuestGeneration.instance()).toBe(PluginGuestGeneration.instance());
    expect(PluginGuestGeneration.instance().startsWith(`${host}-`)).toBe(true);
    // It is part of a socket path (108 bytes at most): hostname 12 + "-" + 6.
    expect(PluginGuestGeneration.instance().length).toBeLessThanOrEqual(19);
  });

  it('is a new one in a new api process on the same host', async () => {
    const first = (await import('@core/plugin/host/generations/plugin-guest-generation')).PluginGuestGeneration.instance();
    vi.resetModules();
    const second = (await import('@core/plugin/host/generations/plugin-guest-generation')).PluginGuestGeneration.instance();
    expect(second).not.toBe(first);
  });
});
