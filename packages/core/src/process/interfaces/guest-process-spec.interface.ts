import type { IGuestIdentity } from '@core/process/interfaces/guest-identity.interface';
import type { ISpawnerGuestLabel } from '@core/process/interfaces/spawner-guest-label.interface';

/** What it takes to start one guest process. The environment is never part of it: guests get none. */
export interface IGuestProcessSpec {
  /** Stable per guest (`plugin-gallery`, `theme-3f9a…`); names its runtime directories. */
  id: string;
  /** The script to run — a built `*-main.js`, never TypeScript. */
  entryPath: string;
  args: string[];
  cwd: string;
  /** Node flags (`--max-old-space-size=…`). */
  execArgv: string[];
  /** Unprivileged identity to run as; null runs as the launching process's own user. */
  identity: IGuestIdentity | null;
  /** Directories the guest may write (its own data dir). Created and owned by `identity` when one is set. */
  writableDirs: string[];
  /** For the spawner to hand back to an api looking for a process to take over; never read by it. */
  label?: ISpawnerGuestLabel;
}
