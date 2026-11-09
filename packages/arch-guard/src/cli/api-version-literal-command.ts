import { ApiVersionLiteralGuard } from '../api-version-literal-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard api-version-literals` — the api answers /api/... only; a path with a version written in 404s. */
export class ApiVersionLiteralCommand extends ArchorCommand {
  readonly summary = 'No hand-written /api/v<N> paths; compose them with ApiPathUtils.';

  run(_argv: string[]): number {
    return ApiVersionLiteralGuard.run();
  }
}
