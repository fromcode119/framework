import { PluginScriptGuard } from '../plugin-script-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard plugin-scripts` — an extension ships packed content, not loose operator tooling. */
export class PluginScriptCommand extends ArchorCommand {
  readonly summary = 'A scripts/ directory inside a plugin, theme or appearance.';

  run(_argv: string[]): number {
    return PluginScriptGuard.run();
  }
}
