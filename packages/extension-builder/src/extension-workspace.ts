import * as fs from 'fs';
import * as path from 'path';
import { ExtensionKind } from '@extension-builder/extension-kind';

/**
 * Where one extension lives, and where its build toolchain resolves from.
 *
 * The monorepo is ONE arrangement, not the arrangement. `build-plugins.sh` assumed a `ROOT_DIR`
 * with `plugins/`, `themes/` and `framework/Source/` as siblings, and reached sideways into
 * `framework/Source/packages/sdk/src/vite/...` — a path that exists on one layout only. The build
 * server already clones a single repo into a temp dir with no monorepo around it, and every plugin
 * is meant to be its own repo, so that assumption was never safe.
 */
export class ExtensionWorkspace {
  private constructor(
    readonly sourceDir: string,
    readonly kind: ExtensionKind,
    readonly toolchainRoot: string,
  ) {}

  static resolve(sourceDir: string, kind: ExtensionKind): ExtensionWorkspace {
    const absolute = path.resolve(sourceDir);
    return new ExtensionWorkspace(absolute, kind, ExtensionWorkspace.findToolchainRoot(absolute));
  }

  /** Where built UI artifacts are SERVED from. The framework always reads the top-level `ui/`. */
  get uiDir(): string {
    return path.join(this.sourceDir, 'ui');
  }

  /**
   * Where UI SOURCE lives. `src/ui/` is the current layout; `ui/` is the legacy one, still found in
   * older clones. Source and served dir are the same place under the legacy layout and different
   * places under the current one, which is exactly the distinction that made mirroring necessary.
   */
  get uiSourceDir(): string {
    const modern = path.join(this.sourceDir, 'src', 'ui');
    return fs.existsSync(modern) ? modern : this.uiDir;
  }

  /**
   * The nearest directory holding `node_modules/.bin` — the extension's own first, then upwards.
   *
   * Upwards is what makes a monorepo work without naming one: a plugin checked out beside the
   * framework finds the hoisted binaries, and the same plugin cloned alone into `/tmp` finds its
   * own. Falls back to the extension itself; it never returns a path outside the tree it was given,
   * because "outside" is the assumption that made the bash unportable.
   */
  private static findToolchainRoot(startDir: string): string {
    let current = startDir;
    for (;;) {
      if (fs.existsSync(path.join(current, 'node_modules', '.bin'))) return current;
      const parent = path.dirname(current);
      if (parent === current) return startDir;
      current = parent;
    }
  }
}
