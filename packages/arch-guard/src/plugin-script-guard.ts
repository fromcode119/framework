/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { ExtensionTrees } from './cli/extension-trees';

/**
 * A loose script sitting inside an extension.
 *
 * An extension ships as packed, checksummed content that the framework loads. A `scripts/` folder in
 * one is none of that: it is operator tooling wearing a plugin's clothes, and it goes wrong in three
 * ways at once.
 *
 * It is HASHED. Adding a file there changes the extension's checksum, and forgetting to re-stamp is a
 * mismatch that self-heals locally and DISABLES the plugin in production — which happened here.
 *
 * It does not RUN where the extension does. These scripts reach for a local topology (`docker exec`
 * into a named container, a psql on the host) that exists on one machine and nowhere the extension is
 * actually installed. A repair that only works on a laptop is not a repair.
 *
 * It goes around the FRAMEWORK. Raw SQL from a script skips the tenancy scoping the DB proxy applies,
 * the hooks that let other plugins react, and the audit trail — on the very tables where those matter
 * most.
 *
 * Where each kind belongs instead: a static check is a guard, here in arch-guard, where CI already
 * runs it. An integration exercise is a test, under the extension's own `tests/`. A data repair is a
 * migration, or a command on the CLI, so it goes through the framework and works wherever the
 * extension is installed.
 */
export class PluginScriptGuard {
  private static readonly DIRECTORY = 'scripts';

  static run(): number {
    const findings: string[] = [];
    let scanned = 0;

    // Every extension family, not just plugins — the reasoning is identical for themes and appearances.
    for (const dir of ExtensionTrees.dirs()) {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        scanned++;
        const scripts = path.join(dir, entry.name, PluginScriptGuard.DIRECTORY);
        if (!fs.existsSync(scripts)) continue;

        const files = PluginScriptGuard.filesIn(scripts);
        // An empty directory is still a place for one to reappear, so it is reported too.
        const listed = files.length ? files.join(', ') : '(empty)';
        findings.push(`${ExtensionTrees.show(scripts)}: ${listed}`);
      }
    }

    if (findings.length) {
      console.error(`[check-plugin-scripts] ${findings.length} extension(s) carry a scripts/ directory:\n`);
      for (const finding of findings) console.error(`  ${finding}`);
      console.error(
        '\nAn extension ships as packed, checksummed content. A scripts/ folder in one is hashed with it,' +
        '\ndoes not run where the extension is installed, and goes around the framework.' +
        '\n\n  a static check    -> a guard in packages/arch-guard' +
        '\n  an integration    -> the extension\'s own tests/' +
        '\n  a data repair     -> a migration, or a CLI command',
      );
      return 1;
    }

    console.log(`Scanned ${scanned} extension(s) across ${ExtensionTrees.dirs().map((dir) => ExtensionTrees.show(dir)).join(', ')}.`);
    console.log('OK — no extension carries a scripts/ directory.');
    return 0;
  }

  /** One level is enough to name the offender; the guard reports, it does not inventory. */
  private static filesIn(dir: string): string[] {
    try {
      return fs.readdirSync(dir, { withFileTypes: true }).map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).sort();
    } catch {
      return [];
    }
  }
}
