import fs from 'node:fs';
import path from 'node:path';

/**
 * Locate the framework workspace root — the directory that owns `packages/`.
 *
 * The `.mjs` CLIs this replaced each derived it from `import.meta.dirname`, which hard-coded how deep
 * the script sat in the tree; moving the entry into `dist/` would have silently shifted every path by
 * one level. Walking up to the directory that owns `packages/` is independent of where the entry lives
 * and of which subdirectory the caller ran from.
 */
export class FrameworkRoot {
  /** The framework workspace root (`framework/Source`). Throws rather than guessing. */
  static find(from: string = process.cwd()): string {
    let dir = path.resolve(from);
    for (;;) {
      if (fs.statSync(path.join(dir, 'packages'), { throwIfNoEntry: false })?.isDirectory()) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) throw new Error('[archor] could not locate the framework root (no packages/ dir found)');
      dir = parent;
    }
  }

  /** The repository root that holds `plugins/` and `themes/` beside `framework/`. */
  static repo(from: string = process.cwd()): string {
    return path.resolve(FrameworkRoot.find(from), '..', '..');
  }
}
