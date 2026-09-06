import { fork } from 'child_process';
import path from 'path';
import { SystemConstants } from '@core/constants/system.constants';
import { SpawnerClient } from '@core/process/spawner-client';

/**
 * An app that was started as root stops being root here, before it does anything else.
 *
 * With `withSpawner`, it first forks the privileged spawner — the only thing that keeps root, and
 * the only way this process can later start a guest as another user. Then it takes the unprivileged
 * user's groups, gid and uid, in that order (a process that drops uid first can no longer drop gid).
 * A process that was not root to begin with is left exactly as it is: development runs as the
 * developer, and that is fine.
 *
 * Why the app itself and not the container's `USER`: a container that starts as an unprivileged user
 * has nobody left who can `setuid`, so every guest would share the app's identity — and a guest that
 * shares your uid can read your `/proc/<pid>/environ`, secrets included. Root for one fork, then never.
 */
export class PrivilegeDrop {
  /** True once this process runs as somebody other than root (or never was root). */
  static get isUnprivileged(): boolean {
    return (process.getuid?.() ?? 1) !== 0;
  }

  static async perform(options: { runAs: string; withSpawner: boolean; runtimeDir?: string; log?: (line: string) => void }): Promise<SpawnerClient | null> {
    const log = options.log ?? ((line: string) => console.info(`[process] ${line}`));
    if (PrivilegeDrop.isUnprivileged) return SpawnerClient.current();

    let client: SpawnerClient | null = null;
    if (options.withSpawner) {
      const child = fork(path.join(__dirname, 'privileged-spawner-main.js'), [options.runtimeDir ?? SystemConstants.PROCESS_ISOLATION.RUNTIME_DIR], {
        // Nothing from this process: no database URL, no secrets. (Typed loosely because the Next apps augment
      // `ProcessEnv` with required keys; an EMPTY environment is the whole point here.)
      env: {} as NodeJS.ProcessEnv,
        serialization: 'advanced',
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });
      client = new SpawnerClient(child);
      await client.ready();
      SpawnerClient.publish(client);
    }

    // POSIX-only calls; the types mark them optional because Windows has none. Order matters: groups
    // and gid while still root, uid last.
    const posix = process as NodeJS.Process & { initgroups?: (user: string, extraGroup: string) => void };
    posix.initgroups?.(options.runAs, options.runAs);
    process.setgid?.(options.runAs);
    process.setuid?.(options.runAs);
    if (!PrivilegeDrop.isUnprivileged) throw new Error(`could not drop privileges to "${options.runAs}"`);
    log(`running as ${options.runAs} (uid ${process.getuid?.()})${client ? `; privileged spawner pid ${client.pid}` : ''}`);
    return client;
  }
}
