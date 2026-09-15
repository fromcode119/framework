import { DialectSqlConfinementGuard } from '../dialect-sql-confinement-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard dialect-sql-confinement` — driver-specific SQL stays beside its driver. */
export class DialectSqlConfinementCommand extends ArchorCommand {
  readonly summary = 'Row-level security and pg-catalog SQL must live in dialects/<dialect>/.';

  run(_argv: string[]): number {
    return DialectSqlConfinementGuard.run() ?? 0;
  }
}
