import path from 'node:path';
import { InterfacePrefixMigration } from '../interface-prefix-migration';
import { ArchorCommand } from './archor-command';
import { FrameworkRoot } from './framework-root';

/**
 * `archor interface-prefix <path> [--apply]` — rename `export interface Foo` to `IFoo` and every
 * reference, via the TypeScript rename API. DRY RUN by default.
 *
 *   archor interface-prefix packages/ai
 *   archor interface-prefix ../../plugins/seo --apply
 */
export class InterfacePrefixCommand extends ArchorCommand {
  readonly summary = 'Rename `interface Foo` -> `IFoo` and every reference [<path> --apply].';

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const apply = argv.includes('--apply');
    const rel = argv.find((a) => !a.startsWith('--'));
    if (!rel) {
      console.error('usage: archor interface-prefix <path> [--apply]');
      return 1;
    }

    const { renamed, skipped } = InterfacePrefixMigration.run(path.resolve(framework, rel), framework, apply);
    for (const line of renamed.slice(0, 15)) console.log('  ' + line);
    if (renamed.length > 15) console.log(`  … and ${renamed.length - 15} more`);
    for (const line of skipped) console.log('  SKIPPED ' + line);
    console.log(`\narchor interface-prefix: ${renamed.length} interface(s) ${apply ? 'renamed' : 'would rename'}, ${skipped.length} skipped.`);
    return 0;
  }
}
