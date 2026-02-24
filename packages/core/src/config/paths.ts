import path from 'path';
import fs from 'fs';

/**
 * Shared utility for resolving system paths across the framework core and CLI.
 */

let cachedRoot: string | null = null;

function resolveFromRoot(root: string, value: string): string {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(root, value);
}

function isFrameworkRoot(candidate: string): boolean {
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

function countPluginManifests(dir: string): number {
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

function countThemeManifests(dir: string): number {
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

/**
 * Resolves the root directory of the Fromcode framework project.
 * It searches upwards from the current working directory for the framework's package.json.
 */
export function getProjectRoot(): string {
  if (cachedRoot) return cachedRoot;

  // Allow explicit override via environment variable
  if (process.env.FROMCODE_PROJECT_ROOT) {
    cachedRoot = path.resolve(process.env.FROMCODE_PROJECT_ROOT);
    return cachedRoot;
  }

  let current = process.cwd();
  const root = path.parse(current).root;
  
  while (current !== root) {
    if (isFrameworkRoot(current)) {
      cachedRoot = current;
      return current;
    }
    current = path.dirname(current);
  }

  // Fallback for runtime contexts where cwd is nested inside workspace packages.
  const fromDirname = path.resolve(__dirname, '../../../../');
  if (isFrameworkRoot(fromDirname)) {
    cachedRoot = fromDirname;
    return fromDirname;
  }

  // Last resort: current working directory.
  cachedRoot = process.cwd();
  return cachedRoot;
}

/**
 * Resolves the directory where plugins are stored.
 * Checks environment variables SHARED_PLUGINS_DIR and PLUGINS_DIR before falling back to a local 'plugins' folder.
 * Relative paths are resolved against the project root.
 */
export function getPluginsDir(): string {
  const root = getProjectRoot();
  const isDev = isFrameworkRoot(root);
  const candidates = [
    process.env.SHARED_PLUGINS_DIR,
    process.env.PLUGINS_DIR,
    isDev ? '../../plugins' : null,
    isDev ? '../plugins' : null,
    'plugins'
  ]
    .filter((value): value is string | null => value !== null && Boolean(String(value || '').trim()))
    .map((value) => resolveFromRoot(root, value as string));

  const deduped = Array.from(new Set(candidates));
  const ranked = deduped
    .map((dir) => ({ dir, manifests: countPluginManifests(dir) }))
    .filter((item) => item.manifests > 0)
    .sort((a, b) => b.manifests - a.manifests);
  if (ranked.length > 0) return ranked[0].dir;

  const existing = deduped.find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
  if (existing) return existing;

  return path.resolve(root, 'plugins');
}

/**
 * Resolves the directory where themes are stored.
 * Checks environment variables SHARED_THEMES_DIR and THEMES_DIR before falling back to a local 'themes' folder.
 * Relative paths are resolved against the project root.
 */
export function getThemesDir(): string {
  const root = getProjectRoot();
  const isDev = isFrameworkRoot(root);
  const candidates = [
    process.env.SHARED_THEMES_DIR,
    process.env.THEMES_DIR,
    isDev ? '../../themes' : null,
    isDev ? '../themes' : null,
    'themes'
  ]
    .filter((value): value is string | null => value !== null && Boolean(String(value || '').trim()))
    .map((value) => resolveFromRoot(root, value as string));

  const deduped = Array.from(new Set(candidates));
  const ranked = deduped
    .map((dir) => ({ dir, manifests: countThemeManifests(dir) }))
    .filter((item) => item.manifests > 0)
    .sort((a, b) => b.manifests - a.manifests);
  if (ranked.length > 0) return ranked[0].dir;

  const existing = deduped.find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
  if (existing) return existing;

  return path.resolve(root, 'themes');
}
