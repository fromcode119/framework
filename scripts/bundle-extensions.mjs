#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
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
      console.log(`[bundle-extensions] ${slug} -> bundled-plugins/${slug} (${archive})`);
    }
  }
}

BundledExtensions.run();
