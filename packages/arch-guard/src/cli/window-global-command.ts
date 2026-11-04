import { WindowGlobalGuard } from '../window-global-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard no-window-globals` — no new writes to `window` / `globalThis`. */
export class WindowGlobalCommand extends ArchorCommand {
  readonly summary = 'A write to a property of the browser window or of globalThis.';

  run(_argv: string[]): number {
    return WindowGlobalGuard.run();
  }
}
