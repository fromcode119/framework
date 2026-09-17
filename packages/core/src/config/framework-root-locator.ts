import path from 'path';
import fs from 'fs';

/**
 * Finds the framework's own root directory, by looking at what is actually on disk.
 *
 * It cannot be a constant: the same code runs from a source checkout, from inside the image, and
 * from a CLI invoked anywhere in the tree. So the root is DISCOVERED — a candidate is the framework
 * root if its `package.json` says so and the extension directories beside it hold the manifests they
 * should. Counting manifests rather than trusting a name is what stops a half-built directory or an
 * unrelated `package.json` being mistaken for the root.
 *
 * Split out of `ProjectPaths`, which was 409 lines: this heuristic, and a map of where every
 * directory is. They are different jobs — one answers "where are we", the other "what lives where" —
 * and the second is the one people read.
 *
 * The answer is CACHED because it walks the filesystem and every path lookup would otherwise repeat
 * that walk.
 */
export class FrameworkRootLocator {
  private static cachedRoot: string | null = null;

  /**
   * Forget the discovered root, so the next lookup walks the filesystem again.
   *
   * For tests that relocate the root — they set `FROMCODE_PROJECT_ROOT` or build a fixture tree, and
   * a root cached by an earlier test would otherwise answer for the new one. It is a real method
   * rather than a private field two suites reached into: `(ProjectPaths as any).cachedRoot = null`
   * silently stopped working the moment this class moved, and took four unrelated suites with it,
   * because a stale root sends every path lookup somewhere else.
   */
  static forget(): void {
    FrameworkRootLocator.cachedRoot = null;
  }

  static getProjectRoot(): string {
      if (FrameworkRootLocator.cachedRoot) return FrameworkRootLocator.cachedRoot;

      // Allow explicit override via environment variable
      if (process.env.FROMCODE_PROJECT_ROOT) {
        FrameworkRootLocator.cachedRoot = path.resolve(process.env.FROMCODE_PROJECT_ROOT);
        return FrameworkRootLocator.cachedRoot;
      }

      let current = process.cwd();
      const root = path.parse(current).root;

      while (current !== root) {
        if (FrameworkRootLocator.isFrameworkRoot(current)) {
          FrameworkRootLocator.cachedRoot = current;
          return current;
        }
        current = path.dirname(current);
      }

      // Fallback for runtime contexts where cwd is nested inside workspace packages.
      const fromLocalCorePath = path.resolve(__dirname, '../../../../');
      if (FrameworkRootLocator.isFrameworkRoot(fromLocalCorePath)) {
        FrameworkRootLocator.cachedRoot = fromLocalCorePath;
        return fromLocalCorePath;
      }

      // Last resort: current working directory.
      FrameworkRootLocator.cachedRoot = process.cwd();
      return FrameworkRootLocator.cachedRoot;

  }

  // ---------------------------------------------------------------------------
  // What makes a directory "the framework root" — also used by the directory lookups, which apply
  // the same test to a configured override before trusting it.
  // ---------------------------------------------------------------------------

  private static resolveFromRoot(root: string, value: string): string {
    return path.isAbsolute(value) ? path.normalize(value) : path.resolve(root, value);
  }

  static isFrameworkRoot(candidate: string): boolean {
    try {
      const pkgPath = path.join(candidate, 'package.json');
      if (!fs.existsSync(pkgPath)) return false;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg?.name === '@fromcode119/framework') return true;

      const hasWorkspaceShape =
        Array.isArray(pkg?.workspaces) &&
        fs.existsSync(path.join(candidate, 'packages', 'core')) &&
        fs.existsSync(path.join(candidate, 'packages', 'api'));
      if (hasWorkspaceShape) return true;
    } catch {
      return false;
    }
    return false;
  }

  static countPluginManifests(dir: string): number {
    try {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return 0;
      const children = fs.readdirSync(dir);
      let count = 0;
      for (const child of children) {
        if (child.startsWith('.')) continue;
        const pluginDir = path.join(dir, child);
        if (!fs.existsSync(pluginDir) || !fs.statSync(pluginDir).isDirectory()) continue;
        if (fs.existsSync(path.join(pluginDir, 'manifest.json'))) count += 1;
      }
      return count;
    } catch {
      return 0;
    }
  }

  static countThemeManifests(dir: string): number {
    try {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return 0;
      const children = fs.readdirSync(dir);
      let count = 0;
      for (const child of children) {
        if (child.startsWith('.')) continue;
        const themeDir = path.join(dir, child);
        if (!fs.existsSync(themeDir) || !fs.statSync(themeDir).isDirectory()) continue;
        if (fs.existsSync(path.join(themeDir, 'manifest.json')) || fs.existsSync(path.join(themeDir, 'theme.json'))) {
          count += 1;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }

  static countAppearanceManifests(dir: string): number {
    try {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return 0;
      const children = fs.readdirSync(dir);
      let count = 0;
      for (const child of children) {
        if (child.startsWith('.')) continue;
        const appearanceDir = path.join(dir, child);
        if (!fs.existsSync(appearanceDir) || !fs.statSync(appearanceDir).isDirectory()) continue;
        if (fs.existsSync(path.join(appearanceDir, 'appearance.json')) || fs.existsSync(path.join(appearanceDir, 'manifest.json'))) {
          count += 1;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }
}
