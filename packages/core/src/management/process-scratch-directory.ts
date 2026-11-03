import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Where a server process keeps its temporary files: one folder per process RUN, under one root.
 *
 * Every router used to `mkdtemp` its own upload folder at construction, and the archive readers and
 * writers did the same per operation. A clean exit removed none of them and a restart in the middle of
 * an upload stranded the half-received chunks, so each boot left another set behind — on one dev stack
 * 7 GB of abandoned import chunks filled the disk until Postgres could no longer write.
 *
 * A run folder is named `<pid>-<startedAt>`. At boot `sweepStale` removes every run folder whose process
 * is gone. A folder carrying THIS process's pid but another start time is a previous incarnation (a
 * container restart hands the api the same pid), so it goes too; a live sibling worker's folder stays.
 */
export class ProcessScratchDirectory {
  static readonly ROOT = path.join(os.tmpdir(), 'fromcode-scratch');

  /** Folder names the code wrote straight into the temp directory before this class existed. */
  private static readonly LEGACY_PATTERN = /^(fromcode-(tenant-import|tenant-export|tenant-import-chunks|plugin-uploads|plugin-upload-chunks|system-backup|system-backup-chunks|plugin-inspect|theme-inspect|site-plugin|plugin-restore|plugin-ext)-|fc-plugin-)/;
  /** A legacy folder younger than this may still belong to a process running the previous release. */
  private static readonly LEGACY_GRACE_MS = 24 * 60 * 60 * 1000;

  private static runName: string | null = null;

  /** A fresh, empty folder inside this run's scratch folder — the drop-in for `fs.mkdtempSync`. */
  static make(prefix: string): string {
    return fs.mkdtempSync(path.join(this.runDirectory(), prefix));
  }

  /** Removes what dead runs left behind. Returns how many folders were removed. */
  static sweepStale(): number {
    let removed = 0;
    for (const name of this.list(this.ROOT)) {
      if (this.isStaleRun(name)) removed += this.remove(path.join(this.ROOT, name));
    }
    const cutoff = Date.now() - this.LEGACY_GRACE_MS;
    for (const name of this.list(os.tmpdir())) {
      if (!this.LEGACY_PATTERN.test(name)) continue;
      const full = path.join(os.tmpdir(), name);
      if (this.modifiedAt(full) < cutoff) removed += this.remove(full);
    }
    return removed;
  }

  private static runDirectory(): string {
    if (!this.runName) this.runName = `${process.pid}-${Date.now()}`;
    const dir = path.join(this.ROOT, this.runName);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private static isStaleRun(name: string): boolean {
    if (name === this.runName) return false;
    const pid = Number(name.split('-')[0]);
    if (!Number.isInteger(pid) || pid <= 0) return true;
    if (pid === process.pid) return true;
    return !this.isAlive(pid);
  }

  private static isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
  }

  private static list(dir: string): string[] {
    try {
      return fs.readdirSync(dir);
    } catch {
      return [];
    }
  }

  private static modifiedAt(full: string): number {
    try {
      return fs.statSync(full).mtimeMs;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  private static remove(full: string): number {
    try {
      fs.rmSync(full, { recursive: true, force: true });
      return 1;
    } catch {
      return 0;
    }
  }
}
