import path from 'node:path';
import { SingleExportModuleGuard } from '../single-export-module-guard';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardScope } from './guard-scope';

/**
 * `arch-guard single-export-module` — a class/interface/enum module exports exactly one thing, and it
 * matches what the file is: a `*.interface.ts` exports one interface and nothing else, a `*.enum.ts`
 * exports one class and nothing else, and any other file that exports a class exports exactly that
 * class and nothing else.
 */
export class SingleExportModuleCommand extends ArchorCommand {
  readonly summary = 'A class/interface/enum module exports exactly one thing, matching what the file is.';

  run(_argv: string[]): number {
    const repoRoot = FrameworkRoot.repo();
    const { offenders, unparseable } = SingleExportModuleGuard.scan(GuardScope.areas(repoRoot));

    if (unparseable.length) {
      console.error('[check-single-export-module] these files did not parse cleanly and were SKIPPED, not counted as clean:');
      for (const file of unparseable) console.error(`- ${path.relative(repoRoot, file)}`);
      console.error('');
    }

    if (!offenders.length) {
      if (unparseable.length) return 1;
      console.log('[check-single-export-module] OK');
      return 0;
    }

    console.error('[check-single-export-module] these files export more than the one thing their kind allows:');
    for (const { file, exports, reason } of offenders) {
      console.error(`- ${path.relative(repoRoot, file)}`);
      console.error(`    exports: ${exports.map((e) => `${e.kind} ${e.name}`).join(', ')}`);
      console.error(`    ${reason}`);
    }
    console.error('\nMove every extra class/interface into its own sibling file (interfaces/<name>.interface.ts for a'
      + '\ncontract), import it back, and un-export anything that does not need to be public. A *.interface.ts file'
      + '\nthat exports a class instead of an interface is misnamed — move it out of interfaces/ and drop the suffix.');
    return 1;
  }
}
