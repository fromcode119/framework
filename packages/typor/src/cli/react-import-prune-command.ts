import path from 'node:path';
import { ReactDefaultImportPrune } from '../react-default-import-prune';
import { TyporCommand } from './typor-command';
import { WorkspaceRoot } from './workspace-root';

/**
 * `typor react-import-prune <path> [--apply]` — remove `import React from 'react'` where the binding is
 * never referenced. DRY RUN by default.
 *
 * ONLY valid for bundles built with `--jsx=automatic` — see the class doc.
 */
export class ReactImportPruneCommand extends TyporCommand {
  readonly summary = "Remove unreferenced `import React from 'react'` [<path> --apply].";

  run(argv: string[]): number {
    const apply = argv.includes('--apply');
    const rel = argv.find((a) => !a.startsWith('--'));
    if (!rel) {
      console.error('usage: typor react-import-prune <path> [--apply]');
      return 1;
    }

    const root = WorkspaceRoot.find();
    const files = ReactDefaultImportPrune.run(path.resolve(root, rel), apply);
    for (const file of files.slice(0, 25)) console.log('  ' + path.relative(root, file));
    if (files.length > 25) console.log(`  … and ${files.length - 25} more`);
    console.log(`\ntypor react-import-prune: ${files.length} file(s) ${apply ? 'pruned' : 'would prune'}.`);
    return 0;
  }
}
