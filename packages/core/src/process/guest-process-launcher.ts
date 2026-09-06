import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';

/**
 * Starts guest processes — isolated plugins, theme render hosts — for whoever hosts them.
 *
 * Two implementations, chosen per process by `GuestProcessLaunchers.current()`: with a privileged
 * spawner (the app started as root, forked the spawner, and dropped to its own user) guests run as
 * their own unprivileged users; without one they are forked directly and share the app's user. The
 * hosts above do not know which they got beyond `isolatesIdentity`, which the admin reports.
 */
export abstract class GuestProcessLauncher {
  /** True when guests really run as the identity the spec names — a different OS user from the app. */
  abstract readonly isolatesIdentity: boolean;

  abstract launch(spec: IGuestProcessSpec): Promise<IGuestProcess>;
}
