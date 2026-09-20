import { IgnoredSourceGuard } from '../ignored-source-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard ignored-sources` — a source file git ignores never reaches a clone. */
export class IgnoredSourceCommand extends ArchorCommand {
  readonly summary = 'Source under packages/ that is gitignored, so an image build cannot see it.';

  run(_argv: string[]): number {
    return IgnoredSourceGuard.run();
  }
}
