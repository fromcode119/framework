#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Packs the framework's OWN extensions into `bundled-plugins/`, which ships inside the image.
 *
 * These are not plugins an operator installs — they are product surface that happens to be built the
 * same way (the build server is the platform's own git-source screen). They live in the image so a
 * fresh installation has them on first boot, with nothing mounted and nothing to enable.
 *
 * Run it whenever one of them changes; the output is committed, because CI builds the image from
 * this repository alone and cannot reach the extension repositories.
 */
class BundledExtensions {
  static SOURCES = { 'build-server': 'plugins/build-server' };

  static get frameworkRoot() {
    return resolve(dirname(fileURLToPath(import.meta.url)), '..');
  }

  static get monorepoRoot() {
    return resolve(BundledExtensions.frameworkRoot, '..', '..');
  }

  /**
   * A plugin's own `.gitignore` ignores its build output — that is correct in the plugin repository,
   * where `index.js` and `ui/` are artifacts. Carried into `bundled-plugins/` it ignores the very
   * files this directory exists to ship: the first bundle committed three files (both manifests and
   * a `.gitignore`), the image carried three files, and the extension silently did not load.
   *
   * Dotfiles are excluded from the integrity checksum, so removing this one cannot invalidate it.
   */
  static stripIgnoreFiles(directory) {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        BundledExtensions.stripIgnoreFiles(path);
        continue;
      }
      if (entry === '.gitignore') unlinkSync(path);
    }
  }

  /**
   * The two ways this bundle can be empty on a server while looking fine here: the build output was
   * never produced, or git refuses to track it. Both were invisible until a container had already
   * booted without the extension, so both are now failures of the bundling command itself.
   */
  static assertShippable(slug, destination) {
    if (!existsSync(join(destination, 'index.js'))) {
      throw new Error(`[bundle-extensions] ${slug}: no index.js in the packed output — the plugin was not built`);
    }

    const ignored = BundledExtensions.listIgnored(BundledExtensions.listFiles(destination));
    if (ignored) {
      throw new Error(`[bundle-extensions] ${slug}: git would not commit these files:\n${ignored}`);
    }
  }

  /** `check-ignore` exits 1 when nothing matches — the healthy case, not a failure. */
  static listIgnored(files) {
    try {
      return execFileSync('git', ['check-ignore', '--stdin'], {
        cwd: BundledExtensions.frameworkRoot,
        input: files.join('\n'),
        encoding: 'utf8',
      }).trim();
    } catch (error) {
      if (error.status === 1) return '';
      throw error;
    }
  }

  static listFiles(directory) {
    return readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      return statSync(path).isDirectory() ? BundledExtensions.listFiles(path) : [path];
    });
  }

  static run() {
    const target = join(BundledExtensions.frameworkRoot, 'bundled-plugins');
    mkdirSync(target, { recursive: true });

    for (const [slug, source] of Object.entries(BundledExtensions.SOURCES)) {
      const sourceDir = join(BundledExtensions.monorepoRoot, source);
      if (!existsSync(sourceDir)) {
        console.error(`[bundle-extensions] ${slug}: ${sourceDir} not found — skipping`);
        continue;
      }

      console.log(`[bundle-extensions] packing ${slug}`);
      execFileSync('npm', ['run', 'fromcode', '--', 'pack', 'plugin', slug], {
        cwd: BundledExtensions.frameworkRoot,
        stdio: 'inherit',
      });

      const archiveDir = join(BundledExtensions.monorepoRoot, 'dist/packages/plugins');
      const archives = readdirSync(archiveDir)
        .filter((name) => name.startsWith(`${slug}-`) && name.endsWith('.tar.gz'))
        .sort();
      const archive = archives[archives.length - 1];
      if (!archive) throw new Error(`[bundle-extensions] ${slug}: pack produced no archive`);

      const destination = join(target, slug);
      rmSync(destination, { recursive: true, force: true });
      mkdirSync(destination, { recursive: true });
      execFileSync('tar', ['-xzf', join(archiveDir, archive), '-C', destination], { stdio: 'inherit' });
      BundledExtensions.stripIgnoreFiles(destination);
      BundledExtensions.assertShippable(slug, destination);
      console.log(`[bundle-extensions] ${slug} -> bundled-plugins/${slug} (${archive})`);
    }
  }
}

BundledExtensions.run();
