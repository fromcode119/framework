import { BlockRegistryDriftGuard } from '../block-registry-drift-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard block-registry-drift` — an editor defines a block the shared registry does not know. */
export class BlockRegistryDriftCommand extends ArchorCommand {
  readonly summary = 'Drift between the shared block registry and the two editors.';

  run(_argv: string[]): number {
    return BlockRegistryDriftGuard.run();
  }
}
