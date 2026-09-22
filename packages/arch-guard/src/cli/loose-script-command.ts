import { LooseScriptGuard } from '../loose-script-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard loose-scripts` — a runnable script is a parallel way of doing things. */
export class LooseScriptCommand extends ArchorCommand {
  readonly summary = 'A committed script (shebang or .sh) outside the declared exception.';

  run(_argv: string[]): number {
    return LooseScriptGuard.run();
  }
}
