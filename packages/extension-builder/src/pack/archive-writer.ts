import * as path from 'path';
import * as fs from 'fs';
import archiver from 'archiver';
import { ThemePackageLayout } from '@fromcode119/core';

/**
 * Creates the distributable ZIP archives for plugin/theme/core packages.
 * Extracted from PackageBuilder to keep that file under the size limit;
 * PackageBuilder delegates archive creation to this class.
 */
export class ArchiveWriter {
  createCoreZip(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err: any) => reject(err));
      archive.on('warning', (err: any) => {
        if (err.code !== 'ENOENT') reject(err);
      });

      archive.pipe(output);

      const coreFiles = [
        '.dockerignore',
        'Dockerfile',
        'docker-compose.yml',
        'package-lock.json',
        'package.json',
        'tsconfig.json',
      ];

      if (fs.existsSync(path.join(sourceDir, 'packages'))) {
        archive.glob('packages/**/*', {
          cwd: sourceDir,
          dot: false,
          ignore: ['**/node_modules/**', '**/.next/**', '**/.git/**', '**/*.log', '**/.DS_Store'],
        });
      }

      for (const fileName of coreFiles) {
        const filePath = path.join(sourceDir, fileName);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: fileName });
        }
      }

      archive.finalize();
    });
  }

  /**
   * Create a ZIP archive containing only distributable files.
   */
  createZip(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err: any) => reject(err));
      archive.on('warning', (err: any) => {
        if (err.code !== 'ENOENT') reject(err);
      });

      archive.pipe(output);

      archive.glob('**/*', {
        cwd: sourceDir,
        dot: false,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/*.ts',
          '**/*.tsx',
          '**/*.js.map',
          'tsconfig.json',
          'tsconfig.*.json',
          '.DS_Store',
          '*.log',
          // Credential-bearing files from the cloned repo, which would otherwise ship INSIDE the
          // artifact the marketplace distributes. `dot: false` above already keeps dotfiles out of
          // THIS packer, so the entries that actually close a hole here are the non-dot ones —
          // `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`. The dotfile entries are stated anyway so
          // this list and `clean_pack_directory` in build-plugins.sh (which packs a tar and DOES
          // include dotfiles) express the same policy and cannot drift apart.
          '.env',
          '.env.*',
          '**/.npmrc',
          '.npmrc',
          '**/.yarnrc',
          '**/.yarnrc.yml',
          '**/.netrc',
          '**/.git-credentials',
          '**/.localcredentials',
          '**/*.pem',
          '**/*.key',
          '**/*.p12',
          '**/*.pfx',
          '**/id_rsa',
          '**/id_rsa*',
          '**/id_ed25519',
          '**/id_ed25519*',
          '**/.ssh/**',
          // CI definitions are build-host configuration, not runtime content, and routinely name
          // secret variables and internal hosts.
          '**/.github/**',
          '.gitignore',
          '.fromcode-plugin-deps.json',
          '*.tsbuildinfo',
          '**/coverage/**',
          '**/tests/**',
          // Same policy as `clean_pack_directory`, which had these and this packer did not.
          // `scripts/` and loose `*.mjs` are the pair that leaked: a *.ts filter does not touch a
          // `.mjs` helper, and one carrying real credentials was published inside a plugin tarball.
          // `ui-ssr/**` is exempt below — it is the SERVER RENDER BUNDLE, and stripping it ships a
          // plugin whose storefront surfaces render nothing.
          '**/scripts/**',
          '**/test/**',
          '**/__tests__/**',
          '**/*.test.*',
          '**/*.spec.*',
          '**/.circleci/**',
          '**/.vscode/**',
          '**/__MACOSX/**',
          '**/*.mjs',
          // Legacy UI source location
          'ui/src/**',
          'ui/package.json',
          'ui/package-lock.json',
          // `src/ui` is BUILD INPUT and nothing in a shipped package can reach it: its components are
          // `.tsx` (stripped above) and its stylesheets and i18n JSON are imported INTO the bundle at
          // build time, never read from disk. The runtime serves `ui/`. `src/i18n` and `src/templates`
          // are NOT excluded — those two are read from disk at runtime.
          'src/ui/**',
        ],
      });

      // Re-add what the blanket `**/*.mjs` exclusion above would otherwise take with it. `ui-ssr`
      // holds the server render bundle the frontend imports; `seed.mjs` is a theme's seed data.
      archive.glob('ui-ssr/**/*.mjs', { cwd: sourceDir, dot: false });
      const seed = path.join(sourceDir, ThemePackageLayout.SEED_ARTIFACT);
      if (fs.existsSync(seed)) archive.file(seed, { name: ThemePackageLayout.SEED_ARTIFACT });

      archive.finalize();
    });
  }

  /**
   * A `.tar.gz` of the directory's CONTENTS (no wrapping folder), matching what
   * `build-plugins.sh` produced with `tar -czf <out> -C <dir> .` — installers unpack it flat, so a
   * wrapping directory would put every file one level too deep.
   */
  async writeTarGz(sourceDir: string, outputPath: string): Promise<void> {
    const tar = require('tar');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.rmSync(outputPath, { force: true });
    await tar.create(
      { gzip: true, cwd: sourceDir, file: outputPath, portable: true },
      fs.readdirSync(sourceDir),
    );
  }
}
