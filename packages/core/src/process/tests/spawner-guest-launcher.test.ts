import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { SpawnerGuestLauncher } from '@core/process/spawner-guest-launcher';
import type { SpawnerClient } from '@core/process/spawner-client';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';
import type { ISpawnerPrepared } from '@core/process/interfaces/spawner-prepared.interface';

type ExitListener = (code: number | null, signal: string | null, pid: number | null) => void;

/**
 * Stands in for the privileged spawner's IPC client: `SpawnerGuestLauncher.launch()` only ever calls
 * `prepare`, `forget`, `onExit` and `spawn` on it, so a fake exposing exactly those four is enough to
 * drive the race without a real privileged child process (which needs root to `chown`/`setuid`).
 */
class FakeSpawnerClient {
  private readonly exitListeners = new Map<string, Set<ExitListener>>();
  forgotten = false;

  constructor(
    private readonly prepared: ISpawnerPrepared,
    private readonly onSpawn: (spec: IGuestProcessSpec, hostSocket: string) => Promise<{ pid: number }>,
  ) {}

  async prepare(): Promise<ISpawnerPrepared> {
    return this.prepared;
  }

  forget(): void {
    this.forgotten = true;
  }

  onExit(id: string, listener: ExitListener): void {
    if (!this.exitListeners.has(id)) this.exitListeners.set(id, new Set());
    this.exitListeners.get(id)!.add(listener);
  }

  spawn(spec: IGuestProcessSpec, hostSocket: string): Promise<{ pid: number }> {
    return this.onSpawn(spec, hostSocket);
  }

  emitExit(id: string, code: number | null, signal: string | null, pid: number | null): void {
    for (const listener of this.exitListeners.get(id) ?? []) listener(code, signal, pid);
  }
}

describe('SpawnerGuestLauncher', () => {
  const spec: IGuestProcessSpec = {
    id: 'plugin-test-feature',
    entryPath: '/does/not/run.js',
    args: [],
    cwd: process.cwd(),
    execArgv: [],
    identity: { uid: 20000, gid: 20000 },
    writableDirs: [],
  };

  function tempPrepared(): ISpawnerPrepared {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'spawner-guest-launcher-test-'));
    return { hostDir: path.join(base, 'host'), guestDir: path.join(base, 'guest'), warnings: [] };
  }

  it('does not mistake a predecessor exiting mid-relaunch for the new guest failing to connect', async () => {
    const prepared = tempPrepared();
    const OLD_PID = 111;
    const NEW_PID = 222;

    const fake = new FakeSpawnerClient(prepared, async (_spec, hostSocket) => {
      // The predecessor's SIGKILL (sent by `relaunch()` before `launch()` was ever called) is reported
      // by the privileged spawner HERE — after `onExit` was registered but before `spawn()` resolves,
      // which is exactly the window the fix has to close. It carries a REAL, non-null pid, and it is
      // NOT the pid this call is about to spawn.
      fake.emitExit(spec.id, null, 'SIGKILL', OLD_PID);
      // The new guest connects for real, so `accepting` resolves and `launch()` can return.
      fs.mkdirSync(path.dirname(hostSocket), { recursive: true });
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect(hostSocket);
        socket.once('connect', () => resolve());
        socket.once('error', reject);
      });
      return { pid: NEW_PID };
    });

    const guest = await new SpawnerGuestLauncher(fake as unknown as SpawnerClient).launch(spec);
    expect(guest.pid).toBe(NEW_PID);
    expect(fake.forgotten).toBe(true);
  });

  it('still rejects promptly when the new guest dies before it connects', async () => {
    const prepared = tempPrepared();
    const NEW_PID = 333;

    const fake = new FakeSpawnerClient(prepared, async () => {
      // Resolve `spawn()` first, exactly as a real spawn does (the response is sent before the child
      // process has had any chance to exit), then report the NEW guest's own, genuine crash.
      setTimeout(() => fake.emitExit(spec.id, null, 'SIGKILL', NEW_PID), 5);
      return { pid: NEW_PID };
    });

    const launched = new SpawnerGuestLauncher(fake as unknown as SpawnerClient).launch(spec);
    await expect(launched).rejects.toThrow(`guest "${spec.id}" exited (SIGKILL) before it connected`);
  });
});
