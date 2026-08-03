import { AppearanceBoundaryGuard } from '../appearance-boundary-guard';
import { ArchorCommand } from './archor-command';

/** `archor appearance-boundary` — An appearance may not reach past its own bundle boundary. */
export class AppearanceBoundaryCommand extends ArchorCommand {
  readonly summary = 'An appearance may not reach past its own bundle boundary.';

  run(_argv: string[]): number {
    return AppearanceBoundaryGuard.run() ?? 0;
  }
}
