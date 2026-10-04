import type { PlatformScopedHooks } from '@sources/events/hooks/platform-scoped-hooks';
import { BuildService } from '@sources/packaging/build-service';

export class BuildUpdatesCheckHook {
  static readonly EVENT = 'sources:updates:check';

  static register(hooks: PlatformScopedHooks, buildService: BuildService): void {
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
