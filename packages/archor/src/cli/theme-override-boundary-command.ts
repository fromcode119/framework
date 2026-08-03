import { ThemeOverrideBoundaryGuard } from '../theme-override-boundary-guard';
import { ArchorCommand } from './archor-command';

/** `archor theme-override-boundary` — A theme may only override, never reimplement, a plugin surface. */
export class ThemeOverrideBoundaryCommand extends ArchorCommand {
  readonly summary = 'A theme may only override, never reimplement, a plugin surface.';

  run(_argv: string[]): number {
    return ThemeOverrideBoundaryGuard.run() ?? 0;
  }
}
