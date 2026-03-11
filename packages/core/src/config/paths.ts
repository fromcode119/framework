import path from 'path';
import fs from 'fs';

/**
 * Shared utility for resolving system paths across the framework core and CLI.
 */

export class ProjectPaths {
  private static cachedRoot: string | null = null;

  static getProjectRoot(): string {
      if (ProjectPaths.cachedRoot) return ProjectPaths.cachedRoot;

      // Allow explicit override via environment variable
      if (process.env.FROMCODE_PROJECT_ROOT) {
        ProjectPaths.cachedRoot = path.resolve(process.env.FROMCODE_PROJECT_ROOT);
        return ProjectPaths.cachedRoot;
      }

      let current = process.cwd();
      const root = path.parse(current).root;

      while (current !== root) {
        if (ProjectPaths.isFrameworkRoot(current)) {
          ProjectPaths.cachedRoot = current;
          return current;
        }
        current = path.dirname(current);
      }

      // Fallback for runtime contexts where cwd is nested inside workspace packages.
      const fromLocalCorePath = path.resolve(__dirname, '../../../../');
      if (ProjectPaths.isFrameworkRoot(fromLocalCorePath)) {
        ProjectPaths.cachedRoot = fromLocalCorePath;
        return fromLocalCorePath;
      }

      // Last resort: current working directory.
      ProjectPaths.cachedRoot = process.cwd();
      return ProjectPaths.cachedRoot;

  }

  static getPluginsDir(): string {
      const root = ProjectPaths.getProjectRoot();
      const isDev = ProjectPaths.isFrameworkRoot(root);
      const candidates = [
        process.env.SHARED_PLUGINS_DIR,
        process.env.PLUGINS_DIR,
        isDev ? '../../plugins' : null,
        isDev ? '../plugins' : null,
        'plugins'
      ]
        .filter((value): value is string | null => value !== null && Boolean(String(value || '').trim()))
        .map((value) => ProjectPaths.resolveFromRoot(root, value as string));

      const deduped = Array.from(new Set(candidates));
      const ranked = deduped
        .map((dir) => ({ dir, manifests: ProjectPaths.countPluginManifests(dir) }))
        .filter((item) => item.manifests > 0)
        .sort((a, b) => b.manifests - a.manifests);
      if (ranked.length > 0) return ranked[0].dir;

      const existing = deduped.find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
      if (existing) return existing;

      return path.resolve(root, 'plugins');

  }

  static getThemesDir(): string {
      const root = ProjectPaths.getProjectRoot();
      const isDev = ProjectPaths.isFrameworkRoot(root);
      const candidates = [
        process.env.SHARED_THEMES_DIR,
        process.env.THEMES_DIR,
        isDev ? '../../themes' : null,
        isDev ? '../themes' : null,
        'themes'
      ]
        .filter((value): value is string | null => value !== null && Boolean(String(value || '').trim()))
        .map((value) => ProjectPaths.resolveFromRoot(root, value as string));

      const deduped = Array.from(new Set(candidates));
      const ranked = deduped
        .map((dir) => ({ dir, manifests: ProjectPaths.countThemeManifests(dir) }))
        .filter((item) => item.manifests > 0)
        .sort((a, b) => b.manifests - a.manifests);
      if (ranked.length > 0) return ranked[0].dir;

      const existing = deduped.find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
      if (existing) return existing;

      return path.resolve(root, 'themes');

  }

  static getPackagesDir(): string {
      // Allow explicit override via environment variable
      if (process.env.FROMCODE_PACKAGES_DIR) {
        return path.resolve(process.env.FROMCODE_PACKAGES_DIR);
      }

      const root = ProjectPaths.getProjectRoot();

      // Search upward from project root to find packages directory
      // This works both in framework monorepo and in standalone apps
      const candidates = [
        path.resolve(root, 'packages'),
        path.resolve(root, '..', 'packages'),
        path.resolve(root, '..', '..', 'packages'),
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
          // Verify it's actually a packages directory by checking for core package
          const corePath = path.join(candidate, 'core');
          if (fs.existsSync(corePath) && fs.statSync(corePath).isDirectory()) {
            return candidate;
          }
        }
      }

      // Default fallback
      return path.resolve(root, 'packages');

  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static resolveFromRoot(root: string, value: string): string {
    return path.isAbsolute(value) ? path.normalize(value) : path.resolve(root, value);
  }

  private static isFrameworkRoot(candidate: string): boolean {
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

  private static countPluginManifests(dir: string): number {
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

  private static countThemeManifests(dir: string): number {
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
}