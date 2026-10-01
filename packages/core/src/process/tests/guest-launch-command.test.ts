import { describe, expect, it } from 'vitest';
import { GuestLaunchCommand } from '@core/process/guest-launch-command';

describe('GuestLaunchCommand', () => {
  const limits = { cpuPercent: 50, memoryMb: 384, diskMb: 100, maxTasks: 64 };

  it('starts a guest with no process limit as itself', () => {
    expect(GuestLaunchCommand.build('/usr/bin/node', ['main.js'], undefined)).toEqual({ command: '/usr/bin/node', args: ['main.js'] });
  });

  it('starts a guest held to a process limit through prlimit, soft and hard alike, so it cannot raise it', () => {
    expect(GuestLaunchCommand.build('/usr/bin/node', ['--max-old-space-size=256', 'main.js'], limits, (file) => file === '/usr/bin/prlimit'))
      .toEqual({ command: '/usr/bin/prlimit', args: ['--nproc=64:64', '--', '/usr/bin/node', '--max-old-space-size=256', 'main.js'] });
  });

  it('refuses to start it at all where the limit cannot be set', () => {
    expect(() => GuestLaunchCommand.build('/usr/bin/node', ['main.js'], limits, () => false)).toThrow(/no prlimit/);
  });
});
