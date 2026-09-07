import { DependencyOverrideGuard } from '../dependency-override-guard';
import { ArchorCommand } from './archor-command';

/** `archor dependency-overrides` — security-motivated npm overrides must match what was audited. */
export class DependencyOverridesCommand extends ArchorCommand {
  readonly summary = 'Security-motivated npm overrides must still be exactly what was audited.';

  run(_argv: string[]): number {
    return DependencyOverrideGuard.run();
  }
}
