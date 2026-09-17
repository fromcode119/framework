import path from 'node:path';
import { ReExportGuard } from '../re-export-guard';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardScope } from './guard-scope';

/** `arch-guard re-exports` — only a barrel re-exports another module's declarations. */
export class ReExportCommand extends ArchorCommand {
  readonly summary = 'Only a barrel (index/client/server) may re-export another module.';

  run(_argv: string[]): number {
    const repoRoot = FrameworkRoot.repo();
    const offenders = ReExportGuard.scan(GuardScope.areas(repoRoot));

    if (!offenders.length) {
      console.log('[check-re-exports] OK');
      return 0;
    }

    console.error('[check-re-exports] these non-barrel modules re-export another module:');
    for (const { file, lines } of offenders) {
      console.error(`- ${path.relative(repoRoot, file)}`);
      for (const line of lines) console.error(`    ${line}`);
    }
    console.error('\nA re-export gives a symbol a SECOND import path, and the two drift: move the'
      + '\ndeclaration and only half the call sites break. Import it and let a barrel publish it.');
    return 1;
  }
}
