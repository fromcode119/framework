import path from 'node:path';
import { ModuleConstantFold } from '../module-constant-fold';
import { TyporCommand } from './typor-command';
import { WorkspaceRoot } from './workspace-root';

/**
 * `typor module-constant-fold <path> [--apply]` — move module-level `const`/`let` onto the class that
 * uses them. DRY RUN by default.
 */
export class ModuleConstantFoldCommand extends TyporCommand {
  readonly summary = 'Move module-level const/let onto the class that uses them [<path> --apply].';

  run(argv: string[]): number {
    const apply = argv.includes('--apply');
    const rel = argv.find((a) => !a.startsWith('--'));
    if (!rel) {
      console.error('usage: typor module-constant-fold <path> [--apply]');
      return 1;
    }

    const root = WorkspaceRoot.find();
    const changed = ModuleConstantFold.run(path.resolve(root, rel), apply);
    for (const file of changed) console.log(`  ${path.relative(root, file)}`);
    console.log(`\ntypor module-constant fold: ${changed.length} file(s) ${apply ? 'folded' : 'would fold'}.`);
    if (!apply && changed.length) console.log('re-run with --apply to write.');
    return 0;
  }
}
