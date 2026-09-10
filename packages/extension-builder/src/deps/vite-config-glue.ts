import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

/**
 * Generates — and then removes — the vite/tailwind config entries the build tools load.
 *
 * Those configs are authored as CLASSES; vite and tailwind both need a module with a default
 * export, so `next-build-codegen` generates that entry at build time. It is build OUTPUT, exactly
 * like the Next middleware glue, and `npm run check:vite-glue` fails the build if a generated file
 * is left in the tree — hence `remove()` in a finally, never on the happy path only.
 *
 * This is the SIXTH thing only `build-plugins.sh` did. It is not optional glue: without it the
 * tailwind config does not exist on disk and every plugin stylesheet fails to compile.
 */
export class ViteConfigGlue {
  private static readonly runtimeRequire = createRequire(__filename);

  /** source module, exported class, generated entry — all relative to the framework root. */
  private static readonly ENTRIES: ReadonlyArray<readonly [string, string, string]> = [
    ['packages/sdk/src/vite/theme-vite-config', 'ThemeViteConfig', 'packages/sdk/src/vite/theme.config.ts'],
    ['packages/sdk/src/vite/theme-ssr-vite-config', 'ThemeSsrViteConfig', 'packages/sdk/src/vite/theme-ssr.config.ts'],
    ['packages/sdk/src/vite/plugin-ui-vite-config', 'PluginUiViteConfig', 'packages/sdk/src/vite/plugin-ui.config.ts'],
    ['packages/sdk/src/vite/plugin-ui-ssr-vite-config', 'PluginUiSsrViteConfig', 'packages/sdk/src/vite/plugin-ui-ssr.config.ts'],
    // Same generator, same reason. Tailwind reads it through jiti, so it stays TypeScript.
    ['packages/sdk/src/tailwind/plugin-ui-tailwind-config', 'PluginUiTailwindConfig', 'packages/sdk/src/tailwind/plugin-ui.config.ts'],
  ];

  /**
   * The framework root, found by resolving the SDK rather than by counting `..` segments — the
   * builder must keep working wherever it is installed.
   */
  static frameworkRoot(): string | null {
    try {
      const sdkManifest = ViteConfigGlue.runtimeRequire.resolve('@fromcode119/sdk/package.json');
      return path.resolve(path.dirname(sdkManifest), '..', '..');
    } catch {
      let current = __dirname;
      for (;;) {
        if (fs.existsSync(path.join(current, 'packages', 'sdk', 'package.json'))) return current;
        const parent = path.dirname(current);
        if (parent === current) return null;
        current = parent;
      }
    }
  }

  private static cli(root: string): string {
    return path.join(root, 'packages', 'next-build-codegen', 'dist', 'next-build-codegen-cli.cjs');
  }

  /** Returns the generated file paths, or [] when the generator is unavailable. */
  static generate(): string[] {
    const root = ViteConfigGlue.frameworkRoot();
    if (!root || !fs.existsSync(ViteConfigGlue.cli(root))) return [];

    const written: string[] = [];
    for (const [source, className, outFile] of ViteConfigGlue.ENTRIES) {
      const result = spawnSync('node', [ViteConfigGlue.cli(root), 'vite-config', source, className, outFile], { cwd: root });
      if (result.status === 0) written.push(path.join(root, outFile));
    }
    return written;
  }

  /** Always call this in a `finally`: a leftover generated file fails `check:vite-glue`. */
  static remove(): void {
    const root = ViteConfigGlue.frameworkRoot();
    if (!root || !fs.existsSync(ViteConfigGlue.cli(root))) return;
    const outFiles = ViteConfigGlue.ENTRIES.map(([, , outFile]) => outFile);
    spawnSync('node', [ViteConfigGlue.cli(root), 'verify-vite-config', '--clean', ...outFiles], { cwd: root });
  }
}
