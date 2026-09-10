import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/**
 * Installs an extension's third-party dependencies. THE only copy.
 *
 * It replaced three that had drifted apart — core's `PluginDependencyInstallerService`,
 * build-server's `PackageBuildToolchain`, and `build-plugins.sh` — which is how the same npm crash
 * came to be fixed twice in one day.
 */
export class DependencyInstaller {
  /**
   * `--ignore-scripts` is NOT optional.
   *
   * These installs run inside freshly cloned or freshly uploaded, untrusted package directories.
   * Without the flag npm executes that package's own `preinstall`/`install`/`postinstall` — and
   * every transitive dependency's — as the API process, before a single line has been reviewed or
   * verified. Merely ADDING a build source would be arbitrary code execution. A package that
   * genuinely needs a lifecycle script must become a deliberate, separately approved capability
   * with an operator-visible control; it must never be the silent default.
   *
   * `--legacy-peer-deps` is not optional either, and for a less obvious reason.
   *
   * Peers are HOST-PROVIDED here by design (see `stripHostProvidedDependencies`), so resolving them
   * is pointless — and it is not merely wasted work: `--omit=dev` still builds the ideal tree for
   * devDependencies, so one plugin's `vitest` peer set crashed arborist outright
   * ("Cannot read properties of null (reading 'edgesOut')", npm 10.9.8) and failed the whole plugin
   * at boot. Note this can only surface when a fingerprint changes, so the trigger is whoever next
   * edits a package.json — not whoever introduced the bad peer graph.
   */
  static readonly INSTALL_FLAGS: readonly string[] = ['--no-audit', '--no-fund', '--ignore-scripts', '--legacy-peer-deps'];

  /** The full argv for npm. `ci` is strict and needs a lockfile; without one npm must `install`. */
  static argsFor(options: { omitDev: boolean; hasLockfile?: boolean }): string[] {
    const verb = options.hasLockfile ? 'ci' : 'install';
    return [verb, ...DependencyInstaller.INSTALL_FLAGS, ...(options.omitDev ? ['--omit=dev'] : [])];
  }

  /**
   * `@fromcode119/*` packages are provided by the host at runtime and externalised in the bundle, so
   * an install that sees them 404s and fails the whole extension. Strip them, and drop the lockfile
   * so a plain `install` resolves the real third-party deps only.
   *
   * This rewrites `package.json`, which IS inside the integrity hash — that is tolerable only
   * because it runs before the extension is stamped. Never extend it to strip devDependencies: on
   * an already-stamped extension that would disable it at the next boot.
   */
  static stripHostProvidedDependencies(directory: string): void {
    const packageJsonPath = path.join(directory, 'package.json');
    let pkg: Record<string, Record<string, string>>;
    try {
      pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch {
      return;
    }

    let changed = false;
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
      const deps = pkg?.[field];
      if (!deps || typeof deps !== 'object') continue;
      for (const name of Object.keys(deps)) {
        if (name.startsWith('@fromcode119/')) {
          delete deps[name];
          changed = true;
        }
      }
    }

    if (changed) {
      try {
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
      } catch {
        // Leave the manifest as-is; the install may still fail, but we never make things worse.
      }
    }

    const lockPath = path.join(directory, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
      try {
        fs.rmSync(lockPath);
      } catch {
        // Non-fatal: with the lockfile present npm runs strict `ci`; without it, `install`.
      }
    }
  }

  /** Throws naming the directory — the caller turns that into a typed step failure. */
  static install(directory: string, options: { omitDev: boolean }): void {
    const hasLockfile = fs.existsSync(path.join(directory, 'package-lock.json'));
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(command, DependencyInstaller.argsFor({ omitDev: options.omitDev, hasLockfile }), {
      cwd: directory,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });

    if (result.status !== 0) throw new Error(`Dependency install failed for ${directory}`);
  }
}
