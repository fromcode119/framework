import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';

/** Compiles a plugin's `migrations/` sources. Split out of build-server's `PackageCompiler`. */
export class PluginMigrationsCompiler {
  private static readonly execFileAsync = promisify(execFile);

  private toolchain = new BuildToolchain();

  async compileMigrations(sourceDir: string, manifest: Record<string, any>): Promise<void> {
    // Convention: source .ts migrations live in src/migrations; compiled .js are
    // emitted to the manifest-declared runtime dir (dist/migrations) so the source
    // tree stays TypeScript-only.
    const outputDirName = String(manifest?.migrations || '').trim();
    if (!outputDirName) {
      return;
    }

    const migrationsSourceDir = path.join(sourceDir, 'src/migrations');
    if (!fs.existsSync(migrationsSourceDir)) {
      return;
    }

    const migrationEntries = fs.readdirSync(migrationsSourceDir)
      .filter((fileName) => fileName.endsWith('.ts'))
      .map((fileName) => path.join(migrationsSourceDir, fileName));
    if (migrationEntries.length === 0) {
      return;
    }

    const outputDir = path.join(sourceDir, outputDirName);
    fs.mkdirSync(outputDir, { recursive: true });

    await this.toolchain.installDependencies(sourceDir);
    const esbuild = this.toolchain.loadEsbuild();

    for (const entryFile of migrationEntries) {
      const parsedEntry = path.parse(entryFile);
      const outputFile = path.join(outputDir, `${parsedEntry.name}.js`);
      await esbuild.build({
        entryPoints: [entryFile],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: outputFile,
        alias: this.toolchain.selfAlias(sourceDir),
        external: this.toolchain.nodeExternals(),
        sourcemap: true,
        minify: false,
        logLevel: 'warning',
      });

      if (!fs.existsSync(outputFile)) {
        throw new Error(`Migration build failed: expected compiled file "${path.basename(outputFile)}" was not created`);
      }
    }
  }
}
