import { RequestCoercionGuard } from '../request-coercion-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard request-coercion` — request values must be read through CoercionUtils, not String(x || ''). */
export class RequestCoercionCommand extends ArchorCommand {
  readonly summary = "Request values must be read through CoercionUtils, not String(req.x || '').";

  run(_argv: string[]): number {
    return RequestCoercionGuard.run() ?? 0;
  }
}
