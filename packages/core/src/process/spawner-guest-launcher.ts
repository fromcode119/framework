import path from 'path';
import { GuestProcessLauncher } from '@core/process/guest-process-launcher';
import { SocketMessagePort } from '@core/process/socket-message-port';
import { SpawnedGuestProcess } from '@core/process/spawned-guest-process';
import { SpawnerClient } from '@core/process/spawner-client';
import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';

/**
 * Starts a guest as ITS OWN unprivileged user through the privileged spawner.
 *
 * The order is what makes it safe: the spawner first prepares two directories — one the app owns and
 * the guest's group may traverse, one the guest owns and the app's group may traverse — then the app
 * starts listening in its directory, then the spawner starts the guest with that socket path, and the
 * guest connects. Another guest, running as another user, can traverse neither directory, so it can
 * reach neither socket. No secret is needed and there is no window to race.
 */
export class SpawnerGuestLauncher extends GuestProcessLauncher {
  static readonly CHANNEL_SOCKET = 'channel.sock';
  private static readonly CONNECT_TIMEOUT_MS = 60_000;

  readonly isolatesIdentity = true;

  constructor(private readonly spawner: SpawnerClient) {
    super();
  }

  async launch(spec: IGuestProcessSpec): Promise<IGuestProcess> {
    if (!spec.identity) throw new Error(`guest "${spec.id}" needs an identity to be spawned as`);
    const prepared = await this.spawner.prepare({
      id: spec.id,
      identity: spec.identity,
      appUid: process.getuid?.() ?? 0,
      appGid: process.getgid?.() ?? 0,
      writableDirs: spec.writableDirs,
    });
    for (const warning of prepared.warnings) console.warn(`[spawner] ${spec.id}: ${warning}`);

    const hostSocket = path.join(prepared.hostDir, SpawnerGuestLauncher.CHANNEL_SOCKET);
    // Listening BEFORE the guest exists, so its connect cannot find nothing there.
    const accepting = SocketMessagePort.listenOnce(hostSocket, 0o666, SpawnerGuestLauncher.CONNECT_TIMEOUT_MS);
    accepting.catch(() => undefined);
    // Listeners from a previous life of this guest id (a restart) go first; they belong to a dead process.
    this.spawner.forget(spec.id);
    // `spawn()` is a round trip through the privileged spawner, so there is a real window, after
    // `onExit` is registered but before `spawn()` resolves, where an exit notification can arrive for
    // a process THIS call did not start — most commonly the predecessor being replaced, which a
    // caller like `PluginHostGuestBridge.relaunch()` SIGKILLs immediately before calling `launch()`.
    // The privileged spawner always reports the real pid of whichever child exited (never null for a
    // process it actually spawned), so a plain `spawnedPid !== null` guard is defeated by ordering:
    // during the window `spawnedPid` is still null, the guard short-circuits false, and the OLD
    // guest's death is reported as the NEW guest failing to connect — even though the new guest is
    // about to come up healthy. Buffering exits that arrive before the new pid is known, and only
    // judging them once it is, closes that window regardless of arrival order while still rejecting
    // promptly on a genuine immediate crash of the new guest (its exit carries the now-known pid).
    let spawnedPid: number | null = null;
    let spawnedPidKnown = false;
    const pendingExits: Array<{ code: number | null; signal: string | null; pid: number | null }> = [];
    let rejectExited!: (error: Error) => void;
    const exited = new Promise<never>((_resolve, reject) => {
      rejectExited = reject;
    });
    exited.catch(() => undefined);

    const rejectFor = (code: number | null, signal: string | null): void => {
      rejectExited(new Error(`guest "${spec.id}" exited (${signal ?? code}) before it connected`));
    };
    this.spawner.onExit(spec.id, (code, signal, pid) => {
      if (!spawnedPidKnown) {
        pendingExits.push({ code, signal, pid });
        return;
      }
      if (pid !== null && pid !== spawnedPid) return;
      rejectFor(code, signal);
    });

    const { pid } = await this.spawner.spawn(spec, hostSocket);
    spawnedPid = pid;
    spawnedPidKnown = true;
    // Replay whatever arrived during the window, now that we know which pid is ours; anything for a
    // different (or unspecified-but-foreign) pid is a predecessor and is discarded, not raised.
    const ownExit = pendingExits.find((exit) => exit.pid === null || exit.pid === spawnedPid);
    if (ownExit) rejectFor(ownExit.code, ownExit.signal);

    const port = await Promise.race([accepting, exited]);
    return new SpawnedGuestProcess(this.spawner, spec.id, pid, port, prepared.guestDir);
  }
}
