import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
import { promisify } from 'util';
import { DependencyInstaller } from '@fromcode119/core';

/**
 * Build-toolchain helpers shared by PackageCompiler: dependency installation,
 * esbuild module resolution and the canonical esbuild external/loader option
 * sets. Extracted to keep PackageCompiler under the size limit.
 */
export class BuildToolchain {
  private static readonly execFileAsync = promisify(execFile);
  private static readonly runtimeRequire = createRequire(__filename);

  /**
   * What a plugin's BACKEND bundle leaves unresolved.
   *
   * Aligned deliberately with what `build-plugins.sh` shipped, because that is what is actually
   * running. build-server's list was much longer — it externalised `pdfkit`, `express`, `knex`,
   * `pg`, `tar` and `speakeasy` as "host-provided" — and the two builders therefore produced
   * different artifacts for the same plugin: numerology's index.js was 537KB from one and 3.0MB
   * from the other, the difference being a bundled pdfkit. Two builders quietly disagreeing about
   * what ships is the whole reason this package exists, so the conservative list wins: a
   * self-contained bundle cannot break because a host stopped providing something.
   *
   * The `@fromcode119/*` entries are NOT optional — they are supplied by the host at runtime and
   * are not resolvable from a plugin's own node_modules.
   */
  nodeExternals(): string[] {
    return [
      '@fromcode119/sdk',
      '@fromcode119/core',
      '@fromcode119/database',
      '@fromcode119/media',
      '@fromcode119/email',
      '@fromcode119/cache',
      '@fromcode119/scheduler',
      // Native or otherwise unbundlable, and externalised by build-plugins.sh too.
      'sweph',
      'handlebars',
      // Reaches for chromium-bidi through a runtime require esbuild cannot resolve.
      'playwright-core',
    ];
  }

  browserExternals(extraExternal: string[]): string[] {
    return [
      'react',
      'react-dom',
      '@fromcode119/react',
      '@fromcode119/sdk',
      '@fromcode119/sdk/react',
      '@fromcode119/sdk/admin',
      '@fromcode119/admin',
      '@fromcode119/admin/components',
      'lucide-react',
      'react/jsx-runtime',
      ...extraExternal,
    ];
  }

  /**
   * `@plugin/` is every package's alias for its OWN source tree — the analogue of a theme's `@theme/`.
   * esbuild maps the bare name and every subpath, and the target root differs per package, so it is
   * built per build here rather than living in the shared external/loader sets above.
   *
   * Mirrors the `--alias:@plugin=<package root>` that build-plugins.sh passes on every plugin esbuild
   * invocation. Without it not one `@plugin/...` specifier resolves and the build dies on the entry
   * file's very first import ("Could not resolve @plugin/src/on-init"), so no package can be built.
   */
  selfAlias(packageRoot: string): Record<string, string> {
    return { '@plugin': packageRoot };
  }

  browserLoader(): Record<string, any> {
    return {
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.jsx': 'jsx',
      '.js': 'js',
      '.css': 'css',
      '.svg': 'dataurl',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
    };
  }

  loadEsbuild(): typeof import('esbuild') {
    return BuildToolchain.runtimeRequire(this.getEsbuildModuleName()) as typeof import('esbuild');
  }

  /**
   * The root holding `node_modules/.bin/<name>`, resolved from THIS PACKAGE outwards.
   *
   * Not from the extension: tailwind and terser live in the framework's own `node_modules`, which
   * is a SIBLING of `plugins/<slug>`, not an ancestor — no upward walk from the extension can ever
   * reach it. `build-plugins.sh` hardcoded that sibling path, which is precisely what stopped it
   * working outside the monorepo.
   *
   * Walking out from the builder's own location is layout-free: wherever the builder is installed,
   * the tools it depends on are hoisted somewhere above it. Returns null when the tool genuinely
   * is not installed, so the caller can say so rather than guess.
   */
  static toolRootFor(binaryName: string): string | null {
    let current = path.dirname(BuildToolchain.moduleDirectory());
    for (;;) {
      if (fs.existsSync(path.join(current, 'node_modules', '.bin', binaryName))) return current;
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }

  private static moduleDirectory(): string {
    return __dirname;
  }

  private getEsbuildModuleName(): string {
    return 'esbuild';
  }

  /**
   * `@fromcode119/*` packages are NOT on the public npm registry (host-provided at runtime and
   * externalized at build), so any `npm ci`/`install` that sees them 404s. Strip them from the
   * cloned plugin's manifest and drop the lockfile (so `npm install` runs instead of strict `ci`,
   * and the lock can't re-introduce the unresolvable entries) before installing real deps.
   */
  private sanitizeManifestForBuild(directory: string): void {
    const packageJsonPath = path.join(directory, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return;

    let pkg: any;
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
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    }

    const lockPath = path.join(directory, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
      fs.rmSync(lockPath);
    }
  }

  /**
   * Installing is NOT this class's job any more — core's `DependencyInstaller` is the single copy,
   * and it carries the reasoning for `--ignore-scripts` and `--legacy-peer-deps`. This class keeps
   * only the esbuild option sets, module resolution and manifest inspection.
   *
   * The "node_modules already present" skip is preserved: these run against freshly cloned trees,
   * and re-installing an already-populated one is pure wall-clock.
   */
  installDependencies(directory: string): void {
    if (!BuildToolchain.needsInstall(directory)) return;
    DependencyInstaller.stripHostProvidedDependencies(directory);
    DependencyInstaller.install(directory, { omitDev: true });
  }

  /** Same, but keeps devDependencies — a package's own `build` script usually needs them. */
  installBuildDependencies(directory: string): void {
    if (!BuildToolchain.needsInstall(directory)) return;
    DependencyInstaller.stripHostProvidedDependencies(directory);
    DependencyInstaller.install(directory, { omitDev: false });
  }

  private static needsInstall(directory: string): boolean {
    return fs.existsSync(path.join(directory, 'package.json'))
      && !fs.existsSync(path.join(directory, 'node_modules'));
  }

  hasBuildScript(packageJsonPath: string): boolean {
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return Boolean(packageJson?.scripts?.build);
    } catch {
      return false;
    }
  }
}
