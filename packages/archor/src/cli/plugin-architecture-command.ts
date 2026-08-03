import { PluginArchitectureGuard } from '../plugin-architecture-guard';
import { ArchorCommand } from './archor-command';

/** `archor plugin-architecture` — Plugin layering, file size and legacy-pattern rules. */
export class PluginArchitectureCommand extends ArchorCommand {
  readonly summary = 'Plugin layering, file size and legacy-pattern rules.';

  run(_argv: string[]): number {
    return PluginArchitectureGuard.run() ?? 0;
  }
}
