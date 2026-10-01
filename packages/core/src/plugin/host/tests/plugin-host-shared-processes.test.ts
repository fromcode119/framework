import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HookManager } from '@core/hooks/hook-manager';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';
import { MiddlewareManager } from '@core/plugin/services/runtime/middleware-manager';
import { SpawnerClient } from '@core/process/spawner-client';

/**
 * Several api processes share ONE process per plugin: api 0 starts it, the others attach. A second
 * process per plugin would run its `onInit` twice and keep a second copy of everything it holds — so in
 * api 1, a crash, an overrun deadline, a deploy's move or new limits must never start one.
 */
describe('a plugin host in an api process that does not start plugin processes', () => {
  const env = { workers: process.env.API_WORKERS, index: process.env.API_WORKER_INDEX };
  const currentHost = { name: 'current extension-host' };
  const olderHost = { name: 'older extension-host' };

  beforeEach(() => {
    process.env.API_WORKERS = '2';
    process.env.API_WORKER_INDEX = '1';
    vi.spyOn(SpawnerClient, 'current').mockReturnValue(currentHost as any);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (env.workers === undefined) delete process.env.API_WORKERS; else process.env.API_WORKERS = env.workers;
    if (env.index === undefined) delete process.env.API_WORKER_INDEX; else process.env.API_WORKER_INDEX = env.index;
  });

  const generation = (pid: number, launcher: unknown) => {
    const channel = { label: `p${pid}`, isClosed: false, pendingCount: 0, close: vi.fn(), request: async () => undefined };
    const g = new PluginGuestGeneration(pid, { pid, launcher, socketDir: `/tmp/shared-probe.${pid}`, kill: vi.fn() } as any, channel as any);
    g.described = { contractKeys: [], publicApiKeys: [], manifest: {} };
    return g;
  };

  const host = (previous: PluginGuestGeneration | null, sharedFrom: (excludePid: number | null) => PluginGuestGeneration | null) => {
    const applied: unknown[] = [];
    const h = Object.create(PluginHost.prototype) as any;
    Object.assign(h, {
      slug: 'shared-probe', manifest: { slug: 'shared-probe' }, generation: previous, guest: previous?.guest ?? null, channel: previous?.channel ?? null,
      context: { marker: 'context' }, manager: { hooks: new HookManager(), plugins: new Map(), db: {}, middlewares: new MiddlewareManager() },
      logger: { info() {}, warn() {}, error() {}, debug() {} }, restarts: 0, healthyTimer: null, stopping: false,
      operatorRelaunch: false, awaitingReplacement: false, takenOver: null, sentPeerSignatures: new Map(),
      registrations: { resetForRestart: vi.fn(), apply: async (_ctx: unknown, r: unknown) => { applied.push(r); } },
      proxy: { retarget() {}, inFlight: () => 0 }, limits: { timeoutMs: 1000, memoryMb: 256 },
      invoke: vi.fn(async () => undefined),
      launchGeneration: vi.fn(async () => { throw new Error('api 1 must not start a plugin process'); }),
      takeOver: vi.fn(async (options: { excludePid?: number | null } = {}) => {
        const next = sharedFrom(options.excludePid ?? null);
        if (next) h.takenOver = [{ kind: 'route', path: '/shared-probe/x' }];
        return next;
      }),
    });
    return { h, applied };
  };

  it('after a crash, attaches to the process api 0 starts and takes on what it registered', async () => {
    const next = generation(7, currentHost);
    const { h, applied } = host(null, () => next);
    await h.relaunch({ drain: false });
    expect(h.launchGeneration).not.toHaveBeenCalled();
    expect(h.invoke).not.toHaveBeenCalled(); // no second onInit
    expect(h.channel).toBe(next.channel);
    expect(applied).toEqual([{ kind: 'route', path: '/shared-probe/x' }]);
  });

  it('stops a process stuck past its deadline, and never attaches to that one again', async () => {
    const stuck = generation(3, currentHost);
    const next = generation(8, currentHost);
    const { h } = host(stuck, (excludePid) => (excludePid === 3 ? next : stuck));
    await h.relaunch({ drain: false });
    expect(stuck.guest.kill).toHaveBeenCalledWith('SIGKILL');
    expect(h.takeOver).toHaveBeenCalledWith({ excludePid: 3, quiet: true });
    expect(h.channel).toBe(next.channel);
  });

  it('on a deploy\'s move, lets go of the old process without stopping it (api 0 retires it)', async () => {
    const old = generation(4, olderHost);
    const next = generation(9, currentHost);
    const { h } = host(old, () => next);
    await h.relaunch();
    expect(old.guest.kill).not.toHaveBeenCalled();
    expect(old.channel.close).toHaveBeenCalled();
    expect(h.channel).toBe(next.channel);
  });

  it('when new limits make api 0 replace the process, does not stop the one still serving', async () => {
    const serving = generation(5, currentHost);
    const next = generation(10, currentHost);
    const { h } = host(serving, (excludePid) => (excludePid === 5 ? next : null));
    h.awaitingReplacement = true;
    await h.relaunch();
    expect(serving.guest.kill).not.toHaveBeenCalled();
    expect(h.channel).toBe(next.channel);
  });

  it('held until it restarts (another api process changed the plugin), starts and attaches to nothing', async () => {
    const { h } = host(null, () => generation(11, currentHost));
    h.holdUntilRestart();
    await h.relaunch({ drain: false });
    expect(h.launchGeneration).not.toHaveBeenCalled();
    expect(h.channel).toBeNull();
  });

  it('never starts its own process when api 0 runs none: it waits, then says so', async () => {
    vi.useFakeTimers();
    const { h } = host(null, () => null);
    const acquiring = h.acquire().catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(91_000);
    const outcome = await acquiring;
    expect(outcome).toBeInstanceOf(Error);
    expect(String(outcome.message)).toContain('api process 0 is not running plugin "shared-probe"');
    expect(h.launchGeneration).not.toHaveBeenCalled();
  });

  it('api 0 itself starts the next process, as a single api does', async () => {
    process.env.API_WORKER_INDEX = '0';
    const next = generation(12, currentHost);
    const { h } = host(null, () => null);
    h.launchGeneration = vi.fn(async () => next);
    await h.relaunch({ drain: false });
    expect(h.launchGeneration).toHaveBeenCalledTimes(1);
  });
});
