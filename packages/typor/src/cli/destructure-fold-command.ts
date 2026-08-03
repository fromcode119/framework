import path from 'node:path';
import { ModuleDestructureFold } from '../module-destructure-fold';
import { TyporCommand } from './typor-command';
import { WorkspaceRoot } from './workspace-root';

/**
 * `typor destructure-fold <path> [--apply]` — fold module-level destructuring
 * (`const { A, B } = Source;`) into member access on `Source`. DRY RUN by default.
 */
export class DestructureFoldCommand extends TyporCommand {
  readonly summary = 'Fold module-level destructuring into member access [<path> --apply].';

  run(argv: string[]): number {
    const apply = argv.includes('--apply');
    const rel = argv.find((a) => !a.startsWith('--'));
    if (!rel) {
      console.error('usage: typor destructure-fold <path> [--apply]');
      return 1;
    }

    const root = WorkspaceRoot.find();
    const { files, bindings, skipped } = ModuleDestructureFold.run(path.resolve(root, rel), apply);
    for (const file of files.slice(0, 30)) console.log('  ' + path.relative(root, file));
    if (files.length > 30) console.log(`  … and ${files.length - 30} more`);
    for (const line of [...new Set(skipped)]) console.log('  SKIPPED ' + line);
    console.log(
      `\ntypor destructure-fold: ${bindings} binding(s) in ${files.length} file(s) ` +
      `${apply ? 'folded' : 'would fold'}, ${skipped.length} skipped.`,
    );
    return 0;
  }
}
