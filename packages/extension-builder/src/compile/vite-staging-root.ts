import * as fs from 'fs';
import * as path from 'path';

/**
 * A directory that is BOTH writable and under vite's host root.
 *
 * Under the host root because Node resolves `node_modules` by walking UP: staging anywhere else —
 * `os.tmpdir()`, say — puts vite and `@vitejs/plugin-react` out of reach of the generated config.
 * Writable because in a container that host root is `/app`, owned by root while the process runs as
 * `node`, so creating the staging directory there failed every build with
 * `EACCES mkdir '/app/.fromcode-vite-build-<slug>'` — plugin and theme alike.
 *
 * A subdirectory satisfies both: it still walks up to the same `node_modules`, and a deployment
 * already mounts one the runtime user owns.
 */
export class ViteStagingRoot {
  /** The directory a deployment mounts for runtime state, and the one place under the root we own. */
  private static readonly WRITABLE_SUBDIRECTORY = 'data';

  static resolve(hostDir: string): string {
    for (const candidate of [hostDir, path.join(hostDir, ViteStagingRoot.WRITABLE_SUBDIRECTORY)]) {
      if (ViteStagingRoot.isWritable(candidate)) return candidate;
    }

    throw new Error(
      `No writable staging directory under ${hostDir}. The build needs somewhere beside vite's node_modules it can write.`,
    );
  }

  private static isWritable(directory: string): boolean {
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.accessSync(directory, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}
