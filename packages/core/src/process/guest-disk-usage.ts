import fs from 'fs';
import path from 'path';

/**
 * What one guest keeps on disk: every file owned by its user, in its own directories and in the
 * places any user may write (`/tmp`, `/var/tmp`, `/run/lock`, `/dev/shm`). Each guest runs as a user of
 * its own, so the owner IS the plugin — a file it left in `/tmp` counts the same as one in its data dir.
 */
export class GuestDiskUsage {
  static get SHARED_DIRS(): string[] {
    return ['/tmp', '/var/tmp', '/run/lock', '/dev/shm'];
  }
  /** A plugin's own files past this count are a limit of their own: inodes run out before bytes do. */
  static readonly MAX_FILES = 100_000;
  /** Entries visited per measurement, whoever owns them — bounds the walk itself. */
  private static readonly MAX_VISITS = 1_000_000;

  static measure(uid: number, dirs: string[]): { bytes: number; files: number } {
    let bytes = 0;
    let files = 0;
    let visits = 0;
    const pending = [...new Set([...dirs, ...GuestDiskUsage.SHARED_DIRS])];
    while (pending.length && visits < GuestDiskUsage.MAX_VISITS && files <= GuestDiskUsage.MAX_FILES) {
      const dir = pending.pop() as string;
      let names: string[];
      try {
        names = fs.readdirSync(dir);
      } catch {
        continue;
      }
      for (const name of names) {
        visits += 1;
        const entry = path.join(dir, name);
        let stat: fs.Stats;
        try {
          stat = fs.lstatSync(entry);
        } catch {
          continue;
        }
        if (stat.isSymbolicLink()) continue;
        if (stat.isDirectory()) {
          pending.push(entry);
          continue;
        }
        if (stat.uid !== uid) continue;
        files += 1;
        bytes += stat.size;
      }
    }
    return { bytes, files };
  }

  /**
   * Removes what `uid` left in the places any user may write. A plugin's data dir is its own and
   * outlives its process; `/tmp` is not, and what a stopped or removed plugin left there would otherwise
   * stay on the box's disk for good — and count against it again if it came back.
   */
  static removeShared(uid: number): number {
    let removed = 0;
    const pending = [...GuestDiskUsage.SHARED_DIRS];
    const owned: string[] = [];
    while (pending.length) {
      const dir = pending.pop() as string;
      let names: string[];
      try { names = fs.readdirSync(dir); } catch { continue; }
      for (const name of names) {
        const entry = path.join(dir, name);
        let stat: fs.Stats;
        try { stat = fs.lstatSync(entry); } catch { continue; }
        if (stat.uid === uid) owned.push(entry);
        else if (stat.isDirectory() && !stat.isSymbolicLink()) pending.push(entry);
      }
    }
    for (const entry of owned) {
      try { fs.rmSync(entry, { recursive: true, force: true }); removed += 1; } catch { /* already gone */ }
    }
    return removed;
  }
}
