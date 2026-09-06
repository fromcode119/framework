import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { GuestEntryPort } from '@core/process/guest-entry-port';
import { ProcessEntry } from '@core/process/process-entry';

/**
 * A guest for the launcher tests: answers every request with what it was asked and its own view of
 * the world (pid, environment keys, uid), over whichever port it was given — the same entry contract
 * as the real guests (`GuestEntryPort`, `PluginChannel`, `@ProcessEntry.start`). The test forks it
 * through `tsx`, so it stays TypeScript like everything else.
 */
@ProcessEntry.start('echo-guest')
export class EchoGuestFixture {
  static async main(): Promise<void> {
    const port = await GuestEntryPort.connect();
    const channel = new PluginChannel(port);
    channel.serve(async (type, payload) => {
      if (type === 'exit') process.exit(Number(payload?.code) || 0);
      return { type, payload, pid: process.pid, envKeys: Object.keys(process.env), uid: process.getuid?.() ?? null };
    });
    port.on('disconnect', () => process.exit(0));
    console.log('echo-guest up');
  }
}
