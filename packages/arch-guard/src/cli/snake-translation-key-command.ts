import { SnakeTranslationKeyGuard } from '../snake-translation-key-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard snake-translation-keys` — translation keys are camelCase like every other name. */
export class SnakeTranslationKeyCommand extends ArchorCommand {
  readonly summary = 'Static t() keys still spelled snake_case.';

  run(_argv: string[]): number {
    return SnakeTranslationKeyGuard.run();
  }
}
