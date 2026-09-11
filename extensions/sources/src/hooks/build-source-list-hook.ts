import type { PluginContext } from '@fromcode119/sdk';
import { BuildService } from '@plugin/src/services/build-service';

export class BuildSourceListHook {
  static readonly EVENT = 'sources:list';

  static register(context: PluginContext, buildService: BuildService): void {
    context.hooks.on(BuildSourceListHook.EVENT, async () => {
      const sources = await buildService.getStatus();
      return { sources };
    });
  }
}
