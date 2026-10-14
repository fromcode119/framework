import fs from 'fs';
import path from 'path';
import type { IVersionFile } from '@cli/services/updater/interfaces/version-file.interface';

/**
 * The deployment's `.env`, where `VERSION=` decides which images `docker compose` runs.
 *
 * Updated with the containers so a later `docker compose up` — a reboot of the machine, an operator's
 * own restart — starts the version the updater installed instead of quietly going back. Every other
 * line is kept as it was. Written to a temporary file and renamed, so a crash mid-write leaves the old
 * file, never half of one.
 */
export class EnvVersionFile implements IVersionFile {
  static readonly KEY = 'VERSION';

  constructor(private readonly file: string) {}

  read(): string {
    const line = this.lines().find((entry) => entry.startsWith(`${EnvVersionFile.KEY}=`));
    return line ? line.slice(EnvVersionFile.KEY.length + 1).trim().replace(/^['"]|['"]$/g, '') : '';
  }

  write(version: string): void {
    if (!version) return;
    const lines = this.lines();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    const index = lines.findIndex((entry) => entry.startsWith(`${EnvVersionFile.KEY}=`));
    const line = `${EnvVersionFile.KEY}=${version}`;
    if (index === -1) lines.push(line); else lines[index] = line;
    const temporary = path.join(path.dirname(this.file), `.env.updater-${process.pid}`);
    // `.env` can hold secrets, and the updater runs as root: the replacement keeps the original's
    // permissions and owner, and is never readable by anyone else while it is being written.
    const original = EnvVersionFile.statOf(this.file);
    fs.writeFileSync(temporary, `${lines.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 });
    fs.chmodSync(temporary, original ? original.mode & 0o777 : 0o600);
    if (original) {
      try { fs.chownSync(temporary, original.uid, original.gid); } catch { /* not root: the file is already ours */ }
    }
    fs.renameSync(temporary, this.file);
  }

  private static statOf(file: string): fs.Stats | null {
    try {
      return fs.statSync(file);
    } catch {
      return null;
    }
  }

  private lines(): string[] {
    try {
      return fs.readFileSync(this.file, 'utf8').split('\n');
    } catch {
      return [];
    }
  }
}
