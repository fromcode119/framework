import path from 'node:path';
import { InterfaceSplitMigration } from '../interface-split-migration';
import { TyporCommand } from './typor-command';
import { WorkspaceRoot } from './workspace-root';

/**
 * `typor interface-split <path> [--apply]` — split a multi-interface file into one file per interface
 * under a sibling `interfaces/` dir. DRY RUN by default.
 */
export class InterfaceSplitCommand extends TyporCommand {
  readonly summary = 'Split a multi-interface file into one file per interface [<path> --apply].';

  run(argv: string[]): number {
    const apply = argv.includes('--apply');
    const rel = argv.find((a) => !a.startsWith('--'));
    if (!rel) {
      console.error('usage: typor interface-split <path> [--apply]');
      return 1;
    }

    const { split, skipped } = InterfaceSplitMigration.run(path.resolve(WorkspaceRoot.find(), rel), apply);
    for (const s of split) console.log('  ' + s);
    for (const s of skipped) console.log('  SKIPPED ' + s);
    console.log(`\ntypor interface-split: ${split.length} file(s) ${apply ? 'split' : 'would split'}, ${skipped.length} skipped.`);
    return 0;
  }
}
