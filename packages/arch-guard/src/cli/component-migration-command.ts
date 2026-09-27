import fs from 'node:fs';
import path from 'node:path';
import { ComponentDecoratorMigration } from '../component-migration/component-decorator-migration';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { ExtensionTrees } from './extension-trees';

/**
 * `arch-guard component-migration <path> [--apply]` — convert components carrying `<Props, State>`
 * generics to `@prop` / `@state` fields. DRY RUN by default.
 *
 *   arch-guard component-migration packages/react
 *   arch-guard component-migration plugins/<slug> --apply
 */
export class ComponentMigrationCommand extends ArchorCommand {
  readonly summary = 'Convert <Props,State> components to @prop/@state [<path> --apply].';

  /** A codemod: it REWRITES source. CI must never run it — a check that edits the tree it is
   *  checking cannot be trusted to have checked anything. */
  readonly runsInCi = false;

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const apply = argv.includes('--apply');
    const rel = argv.find((a) => !a.startsWith('--'));
    if (!rel) {
      console.error('usage: arch-guard component-migration <path> [--apply]');
      return 1;
    }

    // Relative to where the command runs, or to the framework root — the first that actually exists.
    // (The `.mjs` this replaced used `.find(c => c)` on the two resolved strings, which always picked
    // the framework one — any other path silently resolved to a missing dir.)
    const target = [path.resolve(rel), path.resolve(framework, rel)].find((c) => fs.existsSync(c));
    if (!target) {
      console.error(`[arch-guard] no such path "${rel}" here or under ${framework}`);
      return 1;
    }

    const { converted, skipped, reasons } = ComponentDecoratorMigration.run(target, framework, apply);
    for (const file of converted) console.log(`  ${ExtensionTrees.show(file)}`);
    for (const [why, count] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`  skipped ${String(count).padStart(4)} — ${why}`);
    }
    console.log(`\narchor component-migration: ${converted.length} file(s) ${apply ? 'converted' : 'would convert'}, ${skipped} class(es) skipped as unsafe.`);
    if (!apply && converted.length) console.log('re-run with --apply to write.');
    return 0;
  }
}
