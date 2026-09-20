import { I18nKeyResolutionGuard } from '../i18n-key-resolution-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard i18n-keys` — a static t() key that resolves to nothing renders as the key itself. */
export class I18nKeyResolutionCommand extends ArchorCommand {
  readonly summary = 'Static t() keys that resolve to no locale file (read as a delta).';

  run(_argv: string[]): number {
    return I18nKeyResolutionGuard.run();
  }
}
