import type { PlatformScopedHooks } from '@sources/events/hooks/platform-scoped-hooks';
import { BuildService } from '@sources/packaging/build-service';

export class BuildSourceListHook {
  static readonly EVENT = 'sources:list';

  static register(hooks: PlatformScopedHooks, buildService: BuildService): void {
    hooks.on(BuildSourceListHook.EVENT, async () => {
      const sources = await buildService.getStatus();
      return { sources };
    });
  }
}
