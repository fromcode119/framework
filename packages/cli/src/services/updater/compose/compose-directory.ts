import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * The deployment folder (`docker-compose.*.yml`, `edge/…`), brought to a release's own copy of it.
 *
 * Only files the release ships are written; `.env` and anything else the machine keeps of its own is
 * never shipped, so never touched, and nothing is deleted. Each file keeps the owner and permissions of
 * the one it replaces (a new one takes the folder's owner) and is written to a temporary name and
 * renamed, so a crash leaves the old file or the new one, never half. Every change is remembered until
 * the update settles, so a rollback puts the folder back exactly as it was.
 */
export class ComposeDirectory {
  /** What the last `apply` changed: each path with its previous content, or null for a file it added. */
  private previous = new Map<string, Buffer | null>();
  /** Folders the last `apply` made, in the order it made them. */
  private madeDirectories: string[] = [];

  constructor(readonly directory: string) {}

  /** Writes every file that differs; the paths written. */
  apply(files: Map<string, Buffer>): string[] {
    this.previous = new Map();
    this.madeDirectories = [];
    for (const [relative, content] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const target = this.resolve(relative);
      const current = ComposeDirectory.readOrNull(target);
      if (current && current.equals(content)) continue;
      this.previous.set(relative, current);
      this.write(target, content);
    }
    return [...this.previous.keys()];
  }

  /** Puts back what the last `apply` changed, and removes what it added. */
  restore(): void {
    for (const [relative, content] of this.previous) {
      const target = this.resolve(relative);
      if (content) this.write(target, content); else fs.rmSync(target, { force: true });
    }
    // Only an emptied folder goes: one something else wrote into meanwhile stays.
    for (const directory of [...this.madeDirectories].reverse()) { try { fs.rmdirSync(directory); } catch { /* not empty */ } }
    this.previous = new Map();
    this.madeDirectories = [];
  }

  private resolve(relative: string): string {
    const target = path.resolve(this.directory, relative);
    if (!target.startsWith(`${path.resolve(this.directory)}${path.sep}`)) throw new Error(`Refusing to write ${relative} outside the deployment folder.`);
    return target;
  }

  private write(target: string, content: Buffer): void {
    this.makeDirectory(path.dirname(target));
    const owner = ComposeDirectory.lstatOrNull(target) ?? fs.statSync(this.directory);
    if (owner.isSymbolicLink()) throw new Error(`Refusing to write through the link ${target}.`);
    const mode = owner.isFile() ? owner.mode & 0o777 : 0o644;
    const temporary = path.join(path.dirname(target), `.${path.basename(target)}.updater-${crypto.randomBytes(6).toString('hex')}`);
    const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try {
      try { fs.fchownSync(fd, owner.uid, owner.gid); } catch { /* not root: the file is already this process's */ }
      fs.fchmodSync(fd, mode);
      fs.writeFileSync(fd, content);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fs.renameSync(temporary, target);
    } catch (error) {
      try { fs.closeSync(fd); } catch { /* already closed */ }
      fs.rmSync(temporary, { force: true });
      throw error;
    }
  }

  /** A missing folder (`edge/relay` in a release that adds it) is made with the deployment folder's owner. */
  private makeDirectory(directory: string): void {
    if (fs.existsSync(directory)) return;
    this.makeDirectory(path.dirname(directory));
    fs.mkdirSync(directory, { mode: 0o755 });
    this.madeDirectories.push(directory);
    const owner = fs.statSync(this.directory);
    try { fs.chownSync(directory, owner.uid, owner.gid); } catch { /* not root */ }
  }

  private static readOrNull(file: string): Buffer | null {
    try { return fs.readFileSync(file); } catch { return null; }
  }

  private static lstatOrNull(file: string): fs.Stats | null {
    try { return fs.lstatSync(file); } catch { return null; }
  }
}
