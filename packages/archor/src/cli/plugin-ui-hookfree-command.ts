import { PluginUiHookGuard } from '../plugin-ui-hook-guard';
import { ArchorCommand } from './archor-command';

/** `archor plugin-ui-hookfree` — plugin admin UI is hook-free OOP classes, never function components. */
export class PluginUiHookfreeCommand extends ArchorCommand {
  readonly summary = 'Plugin UI must be hook-free OOP classes.';

  run(_argv: string[]): number {
    const { violations, warnings, scanned } = PluginUiHookGuard.scan();

    if (warnings.length) {
      console.warn(`Plugin UI hook-free check: ${warnings.length} known-offender warnings (allowlisted, fix eventually):`);
      console.warn(warnings.join('\n'));
    }
    if (violations.length) {
      console.error(`Plugin UI hook-free check FAILED (${violations.length} violations across ${scanned} files):\n`);
      console.error(violations.join('\n'));
      return 1;
    }
    console.log(`Plugin UI hook-free check passed (${scanned} files, ${warnings.length} allowlisted warnings).`);
    return 0;
  }
}
