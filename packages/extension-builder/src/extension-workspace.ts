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
   * The nearest root holding a SPECIFIC binary — the extension's own first, then upwards.
   *
   * Per-binary, not one root for everything, and that distinction is load-bearing: a plugin with
   * its own `node_modules` is the nearest root, but tailwind and terser are hoisted to the
   * workspace above it. Resolving one root for all tools found the plugin's, concluded tailwind
   * "is not installed", and skipped every stylesheet. `build-plugins.sh` walked a fallback chain
   * per tool for exactly this reason.
   *
   * Returns null when nothing on the chain has it, so the caller can SAY so instead of guessing.
   */
  toolchainRootFor(binaryName: string): string | null {
    let current = this.sourceDir;
    for (;;) {
      if (fs.existsSync(path.join(current, 'node_modules', '.bin', binaryName))) return current;
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }

  /** The nearest root with ANY `node_modules/.bin`, for callers that need a plausible cwd. */
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
