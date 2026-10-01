import fs from 'fs';
import type { IGuestResourceLimits } from '@core/process/interfaces/guest-resource-limits.interface';

/**
 * The command a guest is started with. A guest held to a number of processes is started through
 * `prlimit`, which sets the kernel's per-user process limit (`RLIMIT_NPROC`, threads included) and
 * then BECOMES the guest — same process, so the limit cannot be lifted: a user may only lower it.
 * Every guest has a user of its own, so the limit is that plugin's alone.
 */
export class GuestLaunchCommand {
  private static readonly PRLIMIT = ['/usr/bin/prlimit', '/bin/prlimit'];

  static build(execPath: string, argv: string[], limits: IGuestResourceLimits | undefined, exists: (file: string) => boolean = fs.existsSync): { command: string; args: string[] } {
    const tasks = limits?.maxTasks ?? 0;
    if (!(tasks > 0)) return { command: execPath, args: argv };
    const prlimit = GuestLaunchCommand.PRLIMIT.find((file) => exists(file));
    // Fail closed: a site's plugin that cannot be held to its limit does not start.
    if (!prlimit) throw new Error('this server has no prlimit, so the plugin cannot be held to its process limit');
    return { command: prlimit, args: [`--nproc=${tasks}:${tasks}`, '--', execPath, ...argv] };
  }
}
