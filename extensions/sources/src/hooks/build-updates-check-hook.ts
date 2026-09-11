import type { PluginContext } from '@fromcode119/sdk';
import { BuildService } from '@plugin/src/services/build-service';

export class BuildUpdatesCheckHook {
  static readonly EVENT = 'sources:updates:check';

  static register(context: PluginContext, buildService: BuildService): void {
    context.hooks.on(BuildUpdatesCheckHook.EVENT, async () => {
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
