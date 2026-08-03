import path from 'node:path';
import { TypeAliasToInterface } from '../type-alias-to-interface';
import { TyporCommand } from './typor-command';
import { WorkspaceRoot } from './workspace-root';

/**
 * `typor type-alias-to-interface <dir> [--apply]` — rewrite module-level `type X = { … }` object-shape
 * aliases as `interface IX { … }`. DRY RUN by default.
 */
export class TypeAliasToInterfaceCommand extends TyporCommand {
  readonly summary = 'Rewrite `type X = {…}` aliases as `interface IX {…}` [<dir> --apply].';

  run(argv: string[]): number {
    const [target, ...flags] = argv;
    if (!target || target.startsWith('--')) {
      console.error('usage: typor type-alias-to-interface <dir> [--apply]');
      return 2;
    }
    const apply = flags.includes('--apply');
    const { converted, skipped } = TypeAliasToInterface.run(path.resolve(target), WorkspaceRoot.find(), apply);

    for (const line of converted) console.log(`  ${line}`);
    for (const line of skipped) console.log(`  SKIPPED ${line}`);
    console.log(`\ntypor type-alias->interface: ${converted.length} converted, ${skipped.length} skipped.`);
    if (!apply) console.log('re-run with --apply to write.');
    return 0;
  }
}
