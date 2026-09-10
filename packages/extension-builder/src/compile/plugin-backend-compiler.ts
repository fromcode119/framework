import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';
import { PluginPackageLayout } from '@fromcode119/core/client';

/**
 * Compiles a plugin's backend entry: `index.ts` -> `index.js`.
 *
 * Split out of build-server's `PackageCompiler`, which had grown past the 300-line limit doing
 * backend, UI, migrations and mirroring at once.
 */
export class PluginBackendCompiler {
  private toolchain = new BuildToolchain();

  /**
   * Compile the plugin's backend entry point: index.ts → index.js
   * Mirrors: CLI plugin.ts lines 418-454
   */
  async compileBackend(sourceDir: string, _slug: string): Promise<void> {
    const entryTs = path.join(sourceDir, PluginPackageLayout.SERVER_ENTRY_SOURCE);
    if (!fs.existsSync(entryTs)) return;

    await this.toolchain.installDependencies(sourceDir);

    const esbuild = this.toolchain.loadEsbuild();

    await esbuild.build({
      entryPoints: [entryTs],
      // esbuild embeds module paths RELATIVE TO CWD in the bundle's comments, so the same plugin
      // built from the workspace root and from framework/Source produced byte-different output.
      // Pinning the working directory to the workspace makes the artifact independent of where
      // the builder happened to be invoked from.
      absWorkingDir: path.resolve(path.dirname(path.dirname(sourceDir))),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
      outfile: path.join(sourceDir, PluginPackageLayout.SERVER_ENTRY),
      alias: this.toolchain.selfAlias(sourceDir),
      external: this.toolchain.nodeExternals(),
      sourcemap: true,
      minify: false,
      logLevel: 'warning',
    });
  }

  /**
   * Compile the plugin's UI entry point → bundle.js
   *
   * Source layout (new): plugins/<slug>/src/ui/index.ts
   * Served location:     plugins/<slug>/ui/bundle.js
   *
   * Falls back to the legacy ui/ layout for older plugin clones.
   * Always mirrors the built artifact to the served ui/ dir afterwards.
   */
}
