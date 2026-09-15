import { PluginRawSqlGuard } from '../plugin-raw-sql-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard plugin-raw-sql` — plugins declare; they do not run SQL at runtime. */
export class PluginRawSqlCommand extends ArchorCommand {
  readonly summary = 'Plugins must not run raw SQL at runtime (migrations exempt).';

  run(_argv: string[]): number {
    return PluginRawSqlGuard.run() ?? 0;
  }
}
