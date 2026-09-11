import * as fs from 'fs';
import * as path from 'path';

/**
 * Takes over the build workspace the extension used under its old name.
 *
 * The workspace is derived from the slug (`data/<slug>`), so renaming `build-server` to `sources`
 * silently pointed it at a new, empty directory. Every archive already produced — the packages the
 * admin links to for download — stayed in the old one: present on disk, unreachable from the screen,
 * and reported by nothing. The database rows still named files that appeared to have vanished.
 *
 * Only ever ADOPTS: a file that already exists under the new name is never overwritten, because that
 * one is the product of the current code and the legacy copy is not. Anything left behind is left
 * behind deliberately and said out loud, rather than merged on a guess.
 */
export class LegacyWorkspaceAdoption {
  private static readonly LEGACY_DIRECTORY_NAME = 'build-server';

  /**
   * Moves what the legacy workspace holds into `workspaceRoot`, once.
   *
   * Returns the number of files adopted so the caller can say so; zero is the normal case on every
   * boot after the first, and on installations that never had the old name.
   */
  static adopt(workspaceRoot: string, log: (message: string) => void): number {
    const legacyRoot = path.join(path.dirname(workspaceRoot), LegacyWorkspaceAdoption.LEGACY_DIRECTORY_NAME);
    if (legacyRoot === workspaceRoot || !fs.existsSync(legacyRoot)) return 0;

    const adopted = LegacyWorkspaceAdoption.adoptDirectory(legacyRoot, workspaceRoot);
    if (adopted > 0) {
      log(`Adopted ${adopted} file(s) from the previous build workspace at ${legacyRoot}.`);
    }

    // The directory itself is left on disk even when empty. Removing it would be tidier and would
    // also be this code deleting a directory it no longer owns, on a path an operator may have
    // pointed somewhere deliberate.
    return adopted;
  }

  private static adoptDirectory(from: string, to: string): number {
    fs.mkdirSync(to, { recursive: true });
    let adopted = 0;

    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const source = path.join(from, entry.name);
      const destination = path.join(to, entry.name);

      if (entry.isDirectory()) {
        adopted += LegacyWorkspaceAdoption.adoptDirectory(source, destination);
        continue;
      }
      if (fs.existsSync(destination)) continue;

      fs.renameSync(source, destination);
      adopted += 1;
    }

    return adopted;
  }
}
