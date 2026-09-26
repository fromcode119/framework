import { ForkGuestLauncher } from '@core/process/fork-guest-launcher';
import { GuestProcessLauncher } from '@core/process/guest-process-launcher';
import { SpawnerClient } from '@core/process/spawner-client';
import { SpawnerGuestLauncher } from '@core/process/spawner-guest-launcher';
import { UnavailableGuestLauncher } from '@core/process/unavailable-guest-launcher';

/**
 * Which launcher this process has. Decided by whether a privileged spawner was published — by
 * `PrivilegeDrop`, before the app dropped root — and re-evaluated on every call, because the Next
 * apps bundle this module from source while their launcher runs it from `dist`: two copies of every
 * class, one shared `globalThis`. Nothing here may be cached in a static field.
 */
export class GuestProcessLaunchers {
  static current(): GuestProcessLauncher {
    const spawner = SpawnerClient.current();
    if (spawner) return new SpawnerGuestLauncher(spawner);
    // Configured for the extension-host and it could not be reached: say so, never fall back quietly.
    const unavailable = SpawnerClient.unavailableReason();
    return unavailable ? new UnavailableGuestLauncher(unavailable) : new ForkGuestLauncher();
  }

  /** Why nothing can be started right now (the `extension-host` is out of reach), or null. */
  static unavailableReason(): string | null {
    return SpawnerClient.current() ? null : SpawnerClient.unavailableReason();
  }

  /** Resolves when something can be started again. */
  static whenAvailable(): Promise<void> {
    return GuestProcessLaunchers.unavailableReason() ? SpawnerClient.whenAvailable() : Promise.resolve();
  }
}
