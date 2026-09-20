import { ExtensionNameGuard } from '../extension-name-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard extension-names` — the framework names no extension. */
export class ExtensionNameCommand extends ArchorCommand {
  readonly summary = 'Framework code must not name a plugin, theme or appearance.';

  run(_argv: string[]): number {
    return ExtensionNameGuard.run();
  }
}
