import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PluginAliasMigration } from '../plugin-alias-migration';
import { ArchorCommand } from './archor-command';
import { FrameworkRoot } from './framework-root';

/**
 * `archor plugin-alias` — rewrite a plugin's relative in-package imports to its `@plugin/` alias.
 *
 *   archor plugin-alias <slug>           # DRY RUN — report what would change
 *   archor plugin-alias <slug> --apply   # write the files
 *   archor plugin-alias --all [--apply]  # every plugin
 *
 * Dry run is the default on purpose: this edits thousands of lines across repositories that are not
 * covered by the framework's git history.
 */
export class PluginAliasCommand extends ArchorCommand {
  readonly summary = 'Rewrite a plugin\'s relative in-package imports to the @plugin/ alias.';

  private static pluginDirs(repoRoot: string): string[] {
    const base = path.join(repoRoot, 'plugins');
    if (!existsSync(base)) return [];
    return readdirSync(base)
      .map((name) => path.join(base, name))
      .filter((dir) => statSync(dir).isDirectory() && existsSync(path.join(dir, 'src')));
  }

  run(argv: string[]): number {
    const repoRoot = FrameworkRoot.repo();
    const apply = argv.includes('--apply');
    const all = argv.includes('--all');
    const slug = argv.find((arg) => !arg.startsWith('--'));

    if (!all && !slug) {
      console.error('Usage: archor plugin-alias <slug> [--apply]   |   archor plugin-alias --all [--apply]');
      return 1;
    }

    const targets = all
      ? PluginAliasCommand.pluginDirs(repoRoot)
      : [path.join(repoRoot, 'plugins', String(slug))];

    let total = 0;
    for (const dir of targets) {
      if (!existsSync(path.join(dir, 'src'))) {
        console.error(`  SKIP  ${path.basename(dir)} — no src/ directory`);
        continue;
      }
      const changes = PluginAliasMigration.run(dir, apply);
      total += changes.length;
      console.log(`  ${path.basename(dir).padEnd(18)} ${String(changes.length).padStart(5)} specifier(s)`);
      if (!all) for (const line of changes) console.log(`      ${line}`);
    }

    console.log(`\n[plugin-alias] ${total} specifier(s) ${apply ? 'REWRITTEN' : 'would change (dry run — pass --apply)'}.`);
    return 0;
  }
}
