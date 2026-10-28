import crypto from 'crypto';
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
    this.save(lines);
  }

  clear(): void {
    const lines = this.lines();
    if (!lines.some((entry) => entry.startsWith(`${EnvVersionFile.KEY}=`))) return;
    this.save(lines.filter((entry) => !entry.startsWith(`${EnvVersionFile.KEY}=`)));
  }

  private save(lines: string[]): void {
    // `.env` can hold secrets, and the updater runs as root. The replacement is created exclusively under
    // an unguessable name and never through a link; its owner and permissions are the original's, set on
    // the open file before a byte is written, so no copy is ever readable by anyone the original was not.
    const original = EnvVersionFile.lstatOf(this.file);
    const temporary = path.join(path.dirname(this.file), `.env.updater-${crypto.randomBytes(8).toString('hex')}`);
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW;
    const fd = fs.openSync(temporary, flags, 0o600);
    try {
      if (original?.isFile()) {
        try { fs.fchownSync(fd, original.uid, original.gid); } catch { /* not root: the file is already ours */ }
        fs.fchmodSync(fd, original.mode & 0o777);
      }
      fs.writeFileSync(fd, `${lines.join('\n').replace(/\n+$/, '')}\n`);
      fs.fsyncSync(fd);
    } catch (error) {
      fs.closeSync(fd);
      fs.rmSync(temporary, { force: true });
      throw error;
    }
    fs.closeSync(fd);
    try {
      fs.renameSync(temporary, this.file);
    } catch (error) {
      fs.rmSync(temporary, { force: true });
      throw error;
    }
  }

  private static lstatOf(file: string): fs.Stats | null {
    try {
      return fs.lstatSync(file);
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
