import type { HookManager } from '@fromcode119/core';
import { BuildService } from '@sources/packaging/build-service';

export class BuildUpdatesCheckHook {
  static readonly EVENT = 'sources:updates:check';

  static register(hooks: HookManager, buildService: BuildService): void {
    hooks.on(BuildUpdatesCheckHook.EVENT, async () => {
      const updates = await buildService.checkForUpdates();
      const changed = updates.filter((update) => update.hasUpdate);
      return {
        changed: changed.length,
        total: updates.length,
        updates,
      };
    });
  }
}
