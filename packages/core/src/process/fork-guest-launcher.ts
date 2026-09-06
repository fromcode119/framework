import { fork } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ForkedGuestProcess } from '@core/process/forked-guest-process';
import { GuestProcessLauncher } from '@core/process/guest-process-launcher';
import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';

/**
 * Starts a guest as a direct child of this process — the launcher for development and for any
 * deployment that runs without root and therefore without the privileged spawner.
 *
 * Everything but the OS identity holds: empty environment, heap ceiling, own process to crash. The
 * `identity` in the spec is ignored because a non-root process cannot change another's user; the
 * launcher says so through {@link isolatesIdentity} and the admin shows it.
 */
export class ForkGuestLauncher extends GuestProcessLauncher {
  readonly isolatesIdentity = false;

  async launch(spec: IGuestProcessSpec): Promise<IGuestProcess> {
    for (const dir of spec.writableDirs) fs.mkdirSync(dir, { recursive: true });
    const socketDir = path.join(os.tmpdir(), `fromcode-${spec.id}`);
    fs.mkdirSync(socketDir, { recursive: true, mode: 0o700 });
    const child = fork(spec.entryPath, spec.args, {
      cwd: spec.cwd,
      // Nothing from this process: no database URL, no secrets. (Typed loosely because the Next apps augment
      // `ProcessEnv` with required keys; an EMPTY environment is the whole point here.)
      env: {} as NodeJS.ProcessEnv,
      serialization: 'advanced',
      execArgv: spec.execArgv,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    return new ForkedGuestProcess(child, socketDir);
  }
}
