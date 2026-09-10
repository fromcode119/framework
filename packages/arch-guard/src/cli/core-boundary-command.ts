import { CoreBoundaryAudit } from '../core-boundary-audit';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard core-boundary` — Audit what core is allowed to import. */
export class CoreBoundaryCommand extends ArchorCommand {
  readonly summary = 'Audit what core is allowed to import.';

  run(_argv: string[]): number {
    return CoreBoundaryAudit.run() ?? 0;
  }
}
