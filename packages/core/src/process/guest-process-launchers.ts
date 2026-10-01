import { ForkGuestLauncher } from '@core/process/fork-guest-launcher';
import { GuestProcessLauncher } from '@core/process/guest-process-launcher';
import { SpawnerClient } from '@core/process/spawner-client';
import { SpawnerGuestLauncher } from '@core/process/spawner-guest-launcher';
import { UnavailableGuestLauncher } from '@core/process/unavailable-guest-launcher';
import { ExtensionHostPool } from '@core/process/extension-host/extension-host-pool';

/**
 * Which launcher this process has. Decided by whether a privileged spawner was published — by
 * `PrivilegeDrop`, before the app dropped root — and re-evaluated on every call, because the Next
 * apps bundle this module from source while their launcher runs it from `dist`: two copies of every
 * class, one shared `globalThis`. Nothing here may be cached in a static field.
 */
export class GuestProcessLaunchers {
  /** The launcher for `pool` (`ExtensionHostPool`); the platform's unless a plugin's pool says otherwise. */
  static current(pool: string = ExtensionHostPool.PLATFORM): GuestProcessLauncher {
    const spawner = SpawnerClient.current(pool);
    if (spawner) return new SpawnerGuestLauncher(spawner);
    // Configured for the extension-host and it could not be reached: say so, never fall back quietly.
    const unavailable = GuestProcessLaunchers.unavailableReason(pool);
    if (unavailable) return new UnavailableGuestLauncher(unavailable);
    return new ForkGuestLauncher();
  }

  /** Why nothing of `pool` can be started right now, or null. */
  static unavailableReason(pool: string = ExtensionHostPool.PLATFORM): string | null {
    if (SpawnerClient.current(pool)) return null;
    const reason = SpawnerClient.unavailableReason(pool);
    if (reason) return reason;
    // A site's plugin runs in its own pool or nowhere: no host of it yet is a reason, not a fallback.
    return pool === ExtensionHostPool.PLATFORM ? null : 'the sandboxed extension-host for plugins sites upload has not connected yet';
  }

  /** Resolves when something of `pool` can be started again. */
  static whenAvailable(pool: string = ExtensionHostPool.PLATFORM): Promise<void> {
    return GuestProcessLaunchers.unavailableReason(pool) ? SpawnerClient.whenAvailable(pool) : Promise.resolve();
  }
}
