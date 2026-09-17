import path from 'node:path';
import { OneContractPerFileGuard } from '../one-contract-per-file-guard';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardScope } from './guard-scope';

/** `arch-guard one-contract-per-file` — an `*.interface.ts` declares one contract, not a bag of them. */
export class OneContractPerFileCommand extends ArchorCommand {
  readonly summary = 'An *.interface.ts file declares ONE contract.';

  run(_argv: string[]): number {
    const repoRoot = FrameworkRoot.repo();
    const offenders = OneContractPerFileGuard.scan(GuardScope.areas(repoRoot));

    if (!offenders.length) {
      console.log('[check-one-contract-per-file] OK');
      return 0;
    }

    console.error('[check-one-contract-per-file] these interface files declare more than one contract:');
    for (const { file, declarations } of offenders) {
      console.error(`- ${path.relative(repoRoot, file)} (${declarations.length})`);
      for (const declaration of declarations) console.error(`    ${declaration}`);
    }
    console.error('\nGive each contract its own `interfaces/<name>.interface.ts`. A file holding several'
      + '\ncannot be imported by the one you want, cannot be moved without moving all of them, and'
      + '\ndefeats file-level exemptions — a declaration added beside an exempt one inherits an'
      + '\nexemption it was never granted.');
    return 1;
  }
}
