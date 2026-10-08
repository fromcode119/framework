import path from 'node:path';
import { PluginBackendTypecheck } from '../plugin-backend-typecheck';
import { ArchorCommand } from './arch-guard-command';
import { ExtensionTrees } from './extension-trees';
import { GuardScope } from './guard-scope';
import { FrameworkRoot } from './framework-root';
import { GuardTarget } from './guard-target';

/**
 * `arch-guard plugin-backend-types` — real `tsc --noEmit` for every plugin's backend.
 *
 * esbuild strips types without checking them and a plugin carries no tsconfig, so a backend had no
 * type gate: a call to a context method that does not exist, or an import of a package the plugin
 * never declared, built green and failed at runtime. Every plugin must report zero.
 *
 *   arch-guard plugin-backend-types                     # error mode (default)
 *   PLUGIN_BACKEND_TYPES_MODE=warn arch-guard …         # report only
 *   arch-guard plugin-backend-types <slug> [<slug>…]    # one or more plugins
 */
export class PluginBackendTypesCommand extends ArchorCommand {
  readonly summary = 'Real tsc --noEmit for every plugin’s backend (esbuild does NOT check types).';

  private static readonly SHOWN = 10;

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const mode = process.env.PLUGIN_BACKEND_TYPES_MODE === 'warn' ? 'warn' : 'error';

    const byName = new Map(PluginBackendTypecheck.pluginDirs(ExtensionTrees.dir('plugins')).map((dir) => [path.basename(dir), dir]));
    const unknown = argv.filter((slug) => !byName.has(slug));
    if (unknown.length) {
      console.error(`[arch-guard] no plugin backend found for: ${unknown.join(', ')}`);
      return 2;
    }
    const selected = argv.length
      ? argv.map((slug) => byName.get(slug) as string)
      : GuardScope.isExtension()
        ? GuardScope.areas().map((entry) => entry.dir).filter((dir) => PluginBackendTypecheck.hasBackend(dir))
        : [...byName.values()];

    console.log('Plugin backend typecheck (real tsc — esbuild does NOT check types):');
    let failed = false;
    for (const dir of selected) {
      const found = PluginBackendTypecheck.report(framework, dir);
      console.log(`  ${path.basename(dir)}: ${found.length} errors${found.length > GuardTarget.COUNT ? ' — MUST BE 0' : ''}`);
      if (found.length > GuardTarget.COUNT) {
        failed = true;
        const shown = found.slice(0, PluginBackendTypesCommand.SHOWN);
        const rest = found.length - shown.length;
        console.error(shown.join('\n') + (rest > 0 ? `\n    … and ${rest} more.` : ''));
      }
    }

    if (failed && mode === 'error') {
      console.error('\nPlugin backend typecheck FAILED — a plugin backend must typecheck with zero errors.');
      return 1;
    }
    console.log(`\nPlugin backend typecheck ${failed ? 'reported issues' : 'passed'} (mode=${mode}).`);
    return 0;
  }
}
