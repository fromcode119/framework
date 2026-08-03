import { DbFindWhereGuard } from '../db-find-where-guard';
import { ArchorCommand } from './archor-command';

/** `archor db-find-where` — db.find/db.count filters must live under where:{...}. */
export class DbFindWhereCommand extends ArchorCommand {
  readonly summary = 'db.find/db.count filters must live under where:{...}.';

  run(_argv: string[]): number {
    return DbFindWhereGuard.run() ?? 0;
  }
}
