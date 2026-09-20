import { SnakePropertyAccessGuard } from '../snake-property-access-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard snake-property-access` — one field, one spelling. */
export class SnakePropertyAccessCommand extends ArchorCommand {
  readonly summary = 'A line reading both `x.fieldName` and `x.field_name` — one of them is dead.';

  run(_argv: string[]): number {
    return SnakePropertyAccessGuard.run();
  }
}
