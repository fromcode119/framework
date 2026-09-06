import { ForkGuestLauncher } from '@core/process/fork-guest-launcher';
import { GuestProcessLauncher } from '@core/process/guest-process-launcher';
import { SpawnerClient } from '@core/process/spawner-client';
import { SpawnerGuestLauncher } from '@core/process/spawner-guest-launcher';

/**
 * Which launcher this process has. Decided by whether a privileged spawner was published — by
 * `PrivilegeDrop`, before the app dropped root — and re-evaluated on every call, because the Next
 * apps bundle this module from source while their launcher runs it from `dist`: two copies of every
 * class, one shared `globalThis`. Nothing here may be cached in a static field.
 */
export class GuestProcessLaunchers {
  static current(): GuestProcessLauncher {
    const spawner = SpawnerClient.current();
    return spawner ? new SpawnerGuestLauncher(spawner) : new ForkGuestLauncher();
  }
}
