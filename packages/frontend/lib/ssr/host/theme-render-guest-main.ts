import { GuestEntryPort, ProcessEntry } from '@fromcode119/core/process';
import { ThemeRenderGuest } from '@/lib/ssr/host/theme-render-guest';

/**
 * Entry of a theme render host process. Bundled by `build:frontend-host` to
 * `packages/frontend/dist-host/theme-render-guest-main.cjs`, because it runs OUTSIDE Next: started by
 * `ThemeRenderHost` through whichever launcher the deployment has, with nothing in its environment.
 */
@ProcessEntry.start('render-guest')
export class ThemeRenderGuestMain {
  static async main(): Promise<void> {
    const port = await GuestEntryPort.connect();
    const guest = new ThemeRenderGuest(port);
    void guest;
    port.on('disconnect', () => process.exit(0));
    process.on('unhandledRejection', (reason) => {
      console.error('render-guest: unhandled rejection', reason instanceof Error ? reason.stack : reason);
    });
  }
}
