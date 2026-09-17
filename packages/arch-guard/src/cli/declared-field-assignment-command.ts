import path from 'node:path';
import { DeclaredFieldAssignmentGuard } from '../declared-field-assignment-guard';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardScope } from './guard-scope';

/** `arch-guard declared-fields` — a `declare`d field that nothing assigns is permanently undefined. */
export class DeclaredFieldAssignmentCommand extends ArchorCommand {
  readonly summary = 'Every `declare`d field is assigned somewhere.';

  run(_argv: string[]): number {
    const repoRoot = FrameworkRoot.repo();
    const offenders = DeclaredFieldAssignmentGuard.scan(GuardScope.areas(repoRoot));

    if (!offenders.length) {
      console.log('[check-declared-fields] OK');
      return 0;
    }

    console.error('[check-declared-fields] these `declare`d fields are never assigned:');
    for (const { file, className, field } of offenders) {
      console.error(`- ${path.relative(repoRoot, file)}: ${className}.${field}`);
    }
    console.error('\n`declare` emits NOTHING, so the field is undefined at runtime and tsc says nothing.'
      + '\nAn initialiser moved onto a shared state base stops running the moment it becomes `declare`.'
      + '\nAssign it explicitly in the concrete class\'s constructor. See DeclaredFieldAssignmentGuard'
      + '\nfor the three outages this has already caused.');
    return 1;
  }
}
