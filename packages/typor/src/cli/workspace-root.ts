import fs from 'node:fs';
import path from 'node:path';

/**
 * Locate the workspace root — the directory that owns `packages/`.
 *
 * npm runs a workspace script with cwd = that package's directory, so the root is found by walking up
 * rather than assuming the caller's cwd. The `.mjs` CLIs this replaced derived it from
 * `import.meta.dirname`, which hard-coded how deep the entry sat in the tree; moving the entry into
 * `dist/` would have shifted every path by one level.
 *
 * typor is STANDALONE — this knows how to find a workspace root, not anything about this project.
 */
export class WorkspaceRoot {
  static find(from: string = process.cwd()): string {
    let dir = path.resolve(from);
    for (;;) {
      if (fs.statSync(path.join(dir, 'packages'), { throwIfNoEntry: false })?.isDirectory()) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) throw new Error('[typor] could not locate the workspace root (no packages/ dir found)');
      dir = parent;
    }
  }
}
