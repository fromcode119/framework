#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Packs the framework's OWN extensions into `bundled-plugins/`, which ships inside the image.
 *
 * These are not plugins an operator installs — they are product surface that happens to be built the
 * same way. They live in the image so a fresh installation has them on first boot, with nothing
 * mounted and nothing to enable.
 *
 * Their SOURCE lives in this repository under `extensions/<slug>`, so this runs during the image
 * build. The output is NOT committed: it was, briefly, when the source still sat in a separate
 * private repository the image build could not reach — which solved a build-input problem by putting
 * minified bundles under version control.
 */
class BundledExtensions {
  /** slug -> source directory, relative to the framework root. */
  static SOURCES = { sources: 'extensions/sources' };

  static get frameworkRoot() {
    return resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
   * An empty bundle looked fine here and only surfaced once a container had already booted without
   * the extension, so producing nothing is now a failure of the bundling command itself.
   */
  static assertShippable(slug, destination) {
    if (!existsSync(join(destination, 'index.js'))) {
      throw new Error(`[bundle-extensions] ${slug}: no index.js in the packed output — it was not built`);
    }
  }

  static run() {
    const target = join(BundledExtensions.frameworkRoot, 'bundled-plugins');
    mkdirSync(target, { recursive: true });

    for (const [slug, source] of Object.entries(BundledExtensions.SOURCES)) {
      const sourceDir = join(BundledExtensions.frameworkRoot, source);
      if (!existsSync(sourceDir)) {
        console.error(`[bundle-extensions] ${slug}: ${sourceDir} not found — skipping`);
        continue;
      }

      console.log(`[bundle-extensions] packing ${slug}`);
      execFileSync('npm', ['run', 'fromcode', '--', 'pack', 'plugin', slug, '--dir', sourceDir], {
        cwd: BundledExtensions.frameworkRoot,
        stdio: 'inherit',
      });

      // Beside the SOURCE, not at the monorepo root: the archive is written relative to the workspace
      // the extension lives in, and these live inside the framework now.
      const archiveDir = join(BundledExtensions.frameworkRoot, 'dist/packages/plugins');
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
