import { SdkBoundaryGuard } from '../sdk-boundary-guard';
import { ArchorCommand } from './archor-command';

/** `archor sdk-boundary` — plugins and themes may import only `@fromcode119/sdk`. */
export class SdkBoundaryCommand extends ArchorCommand {
  readonly summary = 'Plugins and themes may import only @fromcode119/sdk, never core/database/api.';

  run(_argv: string[]): number {
    return SdkBoundaryGuard.run() ?? 0;
  }
}
