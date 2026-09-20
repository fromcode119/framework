import { ScriptPathGuard } from '../script-path-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard script-paths` — an npm script naming a file that is not there. */
export class ScriptPathCommand extends ArchorCommand {
  readonly summary = 'npm scripts must not name files that do not exist.';

  run(_argv: string[]): number {
    return ScriptPathGuard.run();
  }
}
