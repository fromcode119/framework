import { PluginGuest } from '@core/plugin/host/plugin-guest';
import { GuestEntryPort } from '@core/process/guest-entry-port';
import { ProcessEntry } from '@core/process/process-entry';

/**
 * Entry of a plugin's process. Started by `PluginHost` through whichever launcher the deployment has —
 * forked with an IPC channel, or spawned as its own user with the host's socket path on the command
 * line — and with nothing in the environment; everything it needs arrives as the `boot` message.
 */
@ProcessEntry.start('plugin-guest')
export class PluginGuestMain {
  static async main(): Promise<void> {
    const port = await GuestEntryPort.connect();
    const guest = new PluginGuest(port);
    void guest;
    port.on('disconnect', () => process.exit(0));
    process.on('unhandledRejection', (reason) => {
      console.error('plugin-guest: unhandled rejection', reason instanceof Error ? reason.stack : reason);
    });
  }
}
