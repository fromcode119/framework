import type { ChildProcess } from 'child_process';
import type { ISpawnerGuestLabel } from '@core/process/interfaces/spawner-guest-label.interface';
import type { ISpawnerGuestListing } from '@core/process/interfaces/spawner-guest-listing.interface';

/**
 * The processes a spawner has started, and which apis hold each one.
 *
 * A process used to belong to the one connection that asked for it, and died with it. In the
 * `extension-host` container that meant every api restart — every deploy — stopped every plugin and
 * started them all again, in a second set beside the first while a rolling deploy overlapped. Here an
 * api HOLDS a process; a second api can hold it too (`claim`), and when an api goes it only lets go.
 * A process nobody holds any more is stopped after a grace period, so one whose api is never replaced
 * does not run forever.
 */
export class SpawnerGuests<THolder> {
  static readonly ORPHAN_GRACE_MS = 120_000;

  private readonly entries = new Map<string, { child: ChildProcess; label: ISpawnerGuestLabel | null; holders: Set<THolder>; orphaned: NodeJS.Timeout | null }>();

  constructor(private readonly graceMs: number = SpawnerGuests.ORPHAN_GRACE_MS) {}

  add(id: string, child: ChildProcess, holder: THolder, label: ISpawnerGuestLabel | null): void {
    this.entries.set(id, { child, label, holders: new Set([holder]), orphaned: null });
  }

  child(id: string): ChildProcess | null {
    return this.entries.get(id)?.child ?? null;
  }

  /** Who is told about this process's output and exit. */
  holders(id: string): THolder[] {
    return [...(this.entries.get(id)?.holders ?? [])];
  }

  isHeldBy(id: string, holder: THolder): boolean {
    return this.entries.get(id)?.holders.has(holder) ?? false;
  }

  /** Forgets `id` if `child` is still the process under it — a replaced predecessor's exit must not remove its successor. */
  removeIf(id: string, child: ChildProcess): void {
    const entry = this.entries.get(id);
    if (!entry || entry.child !== child) return;
    if (entry.orphaned) clearTimeout(entry.orphaned);
    this.entries.delete(id);
  }

  /** Another api takes hold of a running process. */
  claim(id: string, holder: THolder): { pid: number } {
    const entry = this.entries.get(id);
    if (!entry || !entry.child.pid) throw new Error(`spawner: no running process "${id}" to take over`);
    entry.holders.add(holder);
    if (entry.orphaned) clearTimeout(entry.orphaned);
    entry.orphaned = null;
    return { pid: entry.child.pid };
  }

  /** An api is gone: it lets go of everything it held; what nobody holds now is stopped after the grace. */
  release(holder: THolder): void {
    for (const entry of this.entries.values()) {
      if (!entry.holders.delete(holder) || entry.holders.size > 0) continue;
      if (this.graceMs <= 0) { entry.child.kill('SIGKILL'); continue; }
      entry.orphaned = setTimeout(() => { if (entry.holders.size === 0) entry.child.kill('SIGKILL'); }, this.graceMs);
      entry.orphaned.unref();
    }
  }

  inventory(): Array<Omit<ISpawnerGuestListing, 'guestDir'>> {
    return [...this.entries].filter(([, entry]) => entry.child.pid && entry.child.exitCode === null)
      .map(([id, entry]) => ({ id, pid: entry.child.pid as number, label: entry.label, holders: entry.holders.size }));
  }
}
