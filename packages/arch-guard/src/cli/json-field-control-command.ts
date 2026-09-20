import { JsonFieldControlGuard } from '../json-field-control-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard json-field-controls` — a raw JSON textarea is a stub, not a control. */
export class JsonFieldControlCommand extends ArchorCommand {
  readonly summary = "A `type: 'json'` field with no real admin control, or hidden.";

  run(_argv: string[]): number {
    return JsonFieldControlGuard.run();
  }
}
