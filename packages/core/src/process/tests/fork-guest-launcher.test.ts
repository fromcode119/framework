import path from 'path';
import { describe, expect, it } from 'vitest';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { ForkGuestLauncher } from '@core/process/fork-guest-launcher';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';

describe('ForkGuestLauncher', () => {
  // The fixture is TypeScript, run through tsx (resolved from the framework root, the launch cwd).
  const entry = path.join(__dirname, 'fixtures', 'echo-guest.fixture.ts');
  const execArgv = ['--import', 'tsx', '--max-old-space-size=64'];

  it('starts a guest with an empty environment and talks to it over IPC', async () => {
    const guest = await new ForkGuestLauncher().launch({
      id: 'test-echo', entryPath: entry, args: [], cwd: process.cwd(), execArgv, identity: { uid: 20000, gid: 20000 }, writableDirs: [],
    });
    const lines: string[] = [];
    guest.onOutput((_stream, line) => lines.push(line));
    const channel = new PluginChannel(guest.port);
    const reply = await channel.request<{ pid: number; envKeys: string[]; payload: unknown }>('hello', { n: 1 }, 5_000);
    expect(reply.pid).toBe(guest.pid);
    // macOS stamps `__CF_USER_TEXT_ENCODING` into every child it starts; nothing of OURS may be there.
    expect(reply.envKeys.filter((key) => key !== '__CF_USER_TEXT_ENCODING')).toEqual([]);
    expect(reply.payload).toEqual({ n: 1 });
    expect(guest.socketMode).toBe(0o600);

    const exited = new Promise<[number | null, string | null]>((resolve) => guest.onExit((code, signal) => resolve([code, signal])));
    channel.request('exit', { code: 3 }, 1_000).catch(() => undefined);
    const [code] = await exited;
    expect(code).toBe(3);
    expect(lines).toContain('echo-guest up');
  });

  it('is what a process without a privileged spawner gets, and says it does not isolate identity', () => {
    const launcher = GuestProcessLaunchers.current();
    expect(launcher).toBeInstanceOf(ForkGuestLauncher);
    expect(launcher.isolatesIdentity).toBe(false);
  });
});
