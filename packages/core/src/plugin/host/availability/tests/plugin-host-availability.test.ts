import { afterEach, describe, expect, it } from 'vitest';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { SpawnerClient } from '@core/process/spawner-client';

/**
 * When the `extension-host` container restarts, every plugin process goes with it. A restart counted
 * against the budget then failed three times against nothing and marked the plugin failed; it must
 * instead wait for the container, then start the plugin once — uncounted.
 */
describe('a plugin while the extension-host is out of reach', () => {
  afterEach(() => {
    SpawnerClient.publish(null);
    SpawnerClient.publishUnavailable(null);
  });

  it('waits for it, restarts once it is back, and keeps its restart budget', async () => {
    const warnings: string[] = [];
    let relaunched = 0;
    let disabled = false;
    const host = Object.create(PluginHost.prototype) as any;
    Object.assign(host, {
      slug: 'restart-probe', stopping: false, restarting: false, restarts: 0,
      logger: { info() {}, warn: (line: string) => warnings.push(line), error() {} },
      manager: { disableWithError: async () => { disabled = true; } },
      relaunch: async () => { relaunched += 1; },
    });

    SpawnerClient.publish(null);
    SpawnerClient.publishUnavailable('lost the connection to extension-host at /run/fromcode/spawner.sock; reconnecting');
    const restarting = host.restart('process exited (extension-host disconnected)');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(relaunched).toBe(0);
    expect(warnings[0]).toContain('restarting when it is back');

    SpawnerClient.publishUnavailable(null);
    SpawnerClient.publish({ hostedBy: SpawnerClient.HOSTED_BY_EXTENSION_HOST } as SpawnerClient);
    await restarting;
    expect(relaunched).toBe(1);
    expect(host.restarts).toBe(0);
    expect(host.restarting).toBe(false);
    expect(disabled).toBe(false);
  });

  it('starts an active plugin that could not start at boot, and runs what boot could not, once it is back', async () => {
    const calls: string[] = [];
    const host = Object.create(PluginHost.prototype) as any;
    Object.assign(host, {
      slug: 'boot-probe', stopping: false, guest: null, initDeferred: false, wasEnabled: false, context: {},
      logger: { info() {}, warn() {}, error() {} },
      manager: { plugins: new Map(), db: {}, disableWithError: async () => { calls.push('disabled'); } },
      start: async () => { calls.push('start'); },
      invoke: async (work: { name: string }) => { calls.push(work.name); },
    });

    SpawnerClient.publish(null);
    SpawnerClient.publishUnavailable('extension-host unreachable at /run/fromcode/spawner.sock: connect ENOENT');
    // What boot does for an active plugin: onInit through its stub (deferred, it is not running), then
    // onEnable — which used to start the process, throw, and fail the plugin.
    host.initDeferred = true;
    expect(host.deferWhileUnavailable('onEnable')).toBe(true);
    expect(host.deferWhileUnavailable('onUpdate')).toBe(false);
    const resuming = host.resumeWhenAvailable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toEqual([]);

    SpawnerClient.publishUnavailable(null);
    SpawnerClient.publish({ hostedBy: SpawnerClient.HOSTED_BY_EXTENSION_HOST } as SpawnerClient);
    await resuming;
    expect(calls).toEqual(['start', 'onInit', 'onEnable']);
    expect(host.initDeferred).toBe(false);
  });
});
