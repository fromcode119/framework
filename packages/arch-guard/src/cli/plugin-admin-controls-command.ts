import { PluginAdminControlsGuard } from '../plugin-admin-controls-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard plugin-admin-controls` — plugin admin screens use the console's form components. */
export class PluginAdminControlsCommand extends ArchorCommand {
  readonly summary = 'Plugin admin UI must not draw raw <input>, <select> or <textarea>.';

  /**
   * Plugins are being converted on separate branches; this stays a local check (`npm run
   * check:plugin-admin-controls`) until they have landed, then it joins the CI set by deleting this line.
   */
  readonly runsInCi = false;

  run(_argv: string[]): number {
    return PluginAdminControlsGuard.run();
  }
}
