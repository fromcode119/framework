import { AdminPaletteGuard } from '../admin-palette-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard admin-palette` — colours written into a console screen instead of taken from a token. */
export class AdminPaletteCommand extends ArchorCommand {
  readonly summary = 'Console screens take their colours from the tokens (ratchet: the count may not grow).';

  run(_argv: string[]): number {
    return AdminPaletteGuard.run();
  }
}
