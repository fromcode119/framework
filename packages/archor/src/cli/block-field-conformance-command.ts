import { BlockFieldConformanceGuard } from '../block-field-conformance-guard';
import { ArchorCommand } from './archor-command';

/** `archor block-field-conformance` — a block's editor and renderer must agree on their data keys. */
export class BlockFieldConformanceCommand extends ArchorCommand {
  readonly summary = 'Block editors must not write keys the renderer ignores, nor omit keys it reads.';

  run(_argv: string[]): number {
    return BlockFieldConformanceGuard.run() ?? 0;
  }
}
