import { ModuleLocation } from '@extension-builder/module-location';
import { fileURLToPath } from 'node:url';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { ViteStagingRoot } from '@extension-builder/compile/vite-staging-root';

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
  private static readonly runtimeRequire = ModuleLocation.requireFrom();

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
      let current = ModuleLocation.directory;
      for (;;) {
        if (fs.existsSync(path.join(current, 'packages', 'sdk', 'package.json'))) return current;
        const parent = path.dirname(current);
        if (parent === current) return null;
        current = parent;
      }
    }
  }

  /**
   * Where generated entries are written.
   *
   * NOT beside the class they wrap. That directory is `packages/sdk/src`, which in a container is
   * owned by root while the build runs as `node` — so every generation failed with EACCES, silently,
   * and the tool that needed the entry reported its own version of the problem several steps later
   * ("Specified config file does not exist"). The entry only has to resolve its own relative import
   * and the framework's `node_modules`, both of which hold anywhere under the root.
   */
  private static outputDir(root: string): string {
    return path.join(ViteStagingRoot.resolve(root), '.fromcode-config');
  }

  /**
   * The generated entry's filename, derived from its SOURCE path rather than its basename alone.
   *
   * `packages/sdk/src/vite/plugin-ui.config.ts` and `packages/sdk/src/tailwind/plugin-ui.config.ts`
   * share a basename, so a flat output directory held four files for five entries: the two wrote
   * over each other and whichever generated last silently won. Tailwind happens to be last today,
   * which is the only reason it worked — reorder the list and tailwind is handed a vite config.
   */
  private static targetName(outFile: string): string {
    const parts = outFile.split('/');
    const parent = parts.length > 1 ? parts[parts.length - 2] : '';
    return parent ? `${parent}-${parts[parts.length - 1]}` : parts[parts.length - 1];
  }

  /** The absolute path of a generated entry, for the tool that is about to be pointed at it. */
  static generatedPath(outFile: string): string {
    const root = ViteConfigGlue.frameworkRoot();
    if (!root) return outFile;
    return path.join(ViteConfigGlue.outputDir(root), ViteConfigGlue.targetName(outFile));
  }

  private static cli(root: string): string {
    return path.join(root, 'packages', 'next-build-codegen', 'dist', 'next-build-codegen-cli.cjs');
  }

  /**
   * How many builds are currently relying on the generated entries.
   *
   * They live in ONE directory shared by every build in this process, and builds DO overlap — the
   * per-source Build button is not serialised, and `PluginUiViteCompiler` already stages per slug
   * "so the parallel plugin builds the build server runs never collide". Without this counter the
   * first build to finish ran `remove()` in its `finally` and deleted the configs out from under the
   * one still running, which surfaced three steps away as
   * `tailwind exited 9 — Specified config file ... does not exist` and vanished on a retry.
   */
  private static active = 0;

  /** Returns the generated file paths, or [] when the generator is unavailable. */
  static generate(): string[] {
    ViteConfigGlue.active += 1;
    const root = ViteConfigGlue.frameworkRoot();
    if (!root || !fs.existsSync(ViteConfigGlue.cli(root))) return [];

    const written: string[] = [];
    for (const [source, className, outFile] of ViteConfigGlue.ENTRIES) {
      const target = path.relative(root, path.join(ViteConfigGlue.outputDir(root), ViteConfigGlue.targetName(outFile)));
      fs.mkdirSync(ViteConfigGlue.outputDir(root), { recursive: true });
      const result = spawnSync('node', [ViteConfigGlue.cli(root), 'vite-config', source, className, target], {
        cwd: root,
        encoding: 'utf8',
      });
      if (result.status === 0) {
        written.push(path.join(root, target));
        continue;
      }

      /**
       * A generator failure used to be silent — the entry simply did not appear, and the tool that
       * needed it reported its own confusing version of the problem several steps later ("Specified
       * config file does not exist", "tailwind exited 9"). The cause belongs where it happened.
       */
      ViteConfigGlue.failures.push(
        `${outFile}: ${String(result.stderr || result.stdout || `exit ${String(result.status)}`).trim().split('\n').pop()}`,
      );
    }
    return written;
  }

  /**
   * Why a generated entry is missing, for the step that goes looking for one.
   *
   * Collected rather than thrown: one config failing to generate must not stop the others, and the
   * build step that actually needs the missing file is the right place to report it.
   */
  static readonly failures: string[] = [];

  /** Always call this in a `finally`: a leftover generated file fails `check:vite-glue`. */
  static remove(): void {
    ViteConfigGlue.active = Math.max(0, ViteConfigGlue.active - 1);
    // The last build out turns off the lights. An earlier one must not, or it takes the configs a
    // concurrent build is still reading.
    if (ViteConfigGlue.active > 0) return;

    const root = ViteConfigGlue.frameworkRoot();
    if (!root || !fs.existsSync(ViteConfigGlue.cli(root))) return;
    const outFiles = ViteConfigGlue.ENTRIES.map(([, , outFile]) =>
      path.relative(root, path.join(ViteConfigGlue.outputDir(root), ViteConfigGlue.targetName(outFile))));
    spawnSync('node', [ViteConfigGlue.cli(root), 'verify-vite-config', '--clean', ...outFiles], { cwd: root });
  }
}
