import fs from 'node:fs';
import path from 'node:path';
import { ComponentDecoratorMigration } from '../component-migration/component-decorator-migration';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';

/**
 * `arch-guard component-migration <path> [--apply]` — convert components carrying `<Props, State>`
 * generics to `@prop` / `@state` fields. DRY RUN by default.
 *
 *   arch-guard component-migration packages/react
 *   arch-guard component-migration plugins/<slug> --apply
 */
export class ComponentMigrationCommand extends ArchorCommand {
  readonly summary = 'Convert <Props,State> components to @prop/@state [<path> --apply].';

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const repo = FrameworkRoot.repo();
    const apply = argv.includes('--apply');
    const rel = argv.find((a) => !a.startsWith('--'));
    if (!rel) {
      console.error('usage: arch-guard component-migration <path-relative-to-repo-root-or-framework> [--apply]');
      return 1;
    }

    // The path may be given relative to EITHER root, so take the first candidate that actually exists.
    // (The `.mjs` this replaced used `.find(c => c)` on the two resolved strings, which always picked
    // the framework one — a repo-root path such as `plugins/<slug>` silently resolved to a missing dir.)
    const target = [path.resolve(framework, rel), path.resolve(repo, rel)].find((c) => fs.existsSync(c));
    if (!target) {
      console.error(`[arch-guard] no such path "${rel}" under ${framework} or ${repo}`);
      return 1;
    }

    const { converted, skipped, reasons } = ComponentDecoratorMigration.run(target, framework, apply);
    for (const file of converted) console.log(`  ${path.relative(repo, file)}`);
    for (const [why, count] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`  skipped ${String(count).padStart(4)} — ${why}`);
    }
    console.log(`\narchor component-migration: ${converted.length} file(s) ${apply ? 'converted' : 'would convert'}, ${skipped} class(es) skipped as unsafe.`);
    if (!apply && converted.length) console.log('re-run with --apply to write.');
    return 0;
  }
}
