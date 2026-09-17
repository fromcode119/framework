import path from 'node:path';
import { ExtendedExtendsGuard } from '../extended-extends-guard';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardScope } from './guard-scope';

/** `arch-guard extended-extends` — `extends A, B` stays out of framework source. */
export class ExtendedExtendsCommand extends ArchorCommand {
  readonly summary = 'The extended `extends A, B` clause stays out of framework source.';

  run(_argv: string[]): number {
    const repoRoot = FrameworkRoot.repo();
    const offenders = ExtendedExtendsGuard.scan(GuardScope.areas(repoRoot));

    if (!offenders.length) {
      console.log('[check-extended-extends] OK');
      return 0;
    }

    console.error('[check-extended-extends] these framework files use `extends A, B`:');
    for (const { file, lines } of offenders) {
      console.error(`- ${path.relative(repoRoot, file)}`);
      for (const line of lines) console.error(`    ${line}`);
    }
    console.error('\nThe api dev server is `tsx watch`, and the root tsconfig resolves every framework'
      + '\npackage to its SOURCE — so esbuild parses this file directly and cannot read the clause.'
      + '\nThe whole local stack fails to boot, which is the loop this repository works in.'
      + '\n\nUse a linear chain instead (A extends B extends C). Extensions keep the clause: their own'
      + '\nbuild installs typor\'s esbuild plugin. See ExtendedExtendsGuard for what was tried.');
    return 1;
  }
}
