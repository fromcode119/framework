import { RenderedByTargetGuard } from '../rendered-by-target-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard rendered-by-targets` — a renderedBy that names nothing is `hidden` wearing a label. */
export class RenderedByTargetCommand extends ArchorCommand {
  readonly summary = 'An `admin.renderedBy` whose named field cannot render it.';

  run(_argv: string[]): number {
    return RenderedByTargetGuard.run();
  }
}
