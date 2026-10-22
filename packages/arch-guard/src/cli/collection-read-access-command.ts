import { CollectionReadAccessGuard } from '../collection-read-access-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard collection-read-access` — a collection says who may read it, or only admins can. */
export class CollectionReadAccessCommand extends ArchorCommand {
  readonly summary = 'A non-system plugin collection that declares no access.read.';

  run(_argv: string[]): number {
    return CollectionReadAccessGuard.run();
  }
}
