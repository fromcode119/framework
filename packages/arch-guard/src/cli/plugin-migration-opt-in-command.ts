import { PluginMigrationOptInGuard } from '../plugin-migration-opt-in-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard plugin-migrations` — a plugin migration must be able to run. */
export class PluginMigrationOptInCommand extends ArchorCommand {
  readonly summary = 'Plugin migration files must be opted in (manifest "migrations") or run by the plugin.';

  run(_argv: string[]): number {
    return PluginMigrationOptInGuard.run() ?? 0;
  }
}
