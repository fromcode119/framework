import { PeerSurfaceGuard } from '../peer-surface-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard peer-surface` — a method missing from a hand-listed publicAPI map fails only at runtime. */
export class PeerSurfaceCommand extends ArchorCommand {
  readonly summary = 'A public static absent from its plugin\'s hand-listed publicAPI map.';

  run(_argv: string[]): number {
    return PeerSurfaceGuard.run();
  }
}
