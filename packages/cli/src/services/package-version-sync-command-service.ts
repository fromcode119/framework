import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Propagates the ROOT @fromcode119/framework version into every workspace package.
 *
 * The framework versions as a single unit: you bump the root `package.json` once and that version is
 * stamped into all `packages/*` — no per-package edits. Runs as the first step of the root `build`, so the
 * packages can never drift behind the root again (drift made the engine report a stale version and the
 * updater offer an older registry release as an "upgrade"). Cross-package deps use `*`, so only `version`
 * needs syncing.
 *
 * Lives in the CLI, not a loose script: versioning the workspace is a framework operation and the framework
 * owns its own operations.
 */
export class PackageVersionSyncCommandService {
  private static readonly ROOT_PACKAGE = '@fromcode119/framework';
  private static readonly SCOPE = '@fromcode119/';

  /** Walk up from this file to the framework workspace root (the dir holding `packages/`). */
  static resolveFrameworkRoot(): string {
    let dir = __dirname;
    while (dir !== dirname(dir)) {
      if (existsSync(join(dir, 'packages')) && existsSync(join(dir, 'package.json'))) return dir;
      dir = dirname(dir);
    }
    return process.cwd();
  }

  /** The root framework version, or `''` when the root package is not the framework. */
  static readRootVersion(root: string): string {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    if (pkg.name !== PackageVersionSyncCommandService.ROOT_PACKAGE) return '';
    return String(pkg.version || '').trim();
  }

  /** Stamp `version` into every `@fromcode119/*` package; returns how many files changed. */
  static stampPackages(root: string, version: string): number {
    const packagesDir = join(root, 'packages');
    let changed = 0;
    for (const name of readdirSync(packagesDir)) {
      const pkgPath = join(packagesDir, name, 'package.json');
      if (!existsSync(pkgPath)) continue;

      const raw = readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      if (!String(pkg.name || '').startsWith(PackageVersionSyncCommandService.SCOPE)) continue;
      if (pkg.version === version) continue;

      const previous = pkg.version;
      pkg.version = version;
      // Preserve the file's trailing newline if it had one.
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
      console.log(`[sync-versions] ${pkg.name}: ${previous} -> ${version}`);
      changed += 1;
    }
    return changed;
  }

  static run(): void {
    const root = PackageVersionSyncCommandService.resolveFrameworkRoot();
    const version = PackageVersionSyncCommandService.readRootVersion(root);

    if (!version) {
      console.error('[sync-versions] root @fromcode119/framework version not found — aborting.');
      process.exit(1);
    }

    const changed = PackageVersionSyncCommandService.stampPackages(root, version);
    console.log(`[sync-versions] root @fromcode119/framework@${version}; ${changed} package(s) updated.`);
  }
}
