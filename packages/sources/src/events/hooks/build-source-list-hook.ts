import type { HookManager } from '@fromcode119/core';
import { BuildService } from '@sources/packaging/build-service';

export class BuildSourceListHook {
  static readonly EVENT = 'sources:list';

  static register(hooks: HookManager, buildService: BuildService): void {
    hooks.on(BuildSourceListHook.EVENT, async () => {
      const sources = await buildService.getStatus();
      return { sources };
    });
  }
}
