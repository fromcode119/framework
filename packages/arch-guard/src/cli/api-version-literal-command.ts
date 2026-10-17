import { ApiVersionLiteralGuard } from '../api-version-literal-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard api-version-literals` — api paths are composed from the configured version, never written with it. */
export class ApiVersionLiteralCommand extends ArchorCommand {
  readonly summary = 'No hand-written /api/v<N> paths; compose them with ApiPathUtils.';

  run(_argv: string[]): number {
    return ApiVersionLiteralGuard.run();
  }
}
