import type { ISpawnerGuestLabel } from '@core/process/interfaces/spawner-guest-label.interface';

/** One running process in a spawner's inventory. */
export interface ISpawnerGuestListing {
  id: string;
  pid: number;
  label: ISpawnerGuestLabel | null;
  /** How many apis hold it now; 0 is a process whose api went, waiting out its grace. */
  holders: number;
  /** Its own socket directory — where an api attaches (`control.sock`). */
  guestDir: string;
}
