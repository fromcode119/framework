import type { PluginContext } from '@fromcode119/sdk';
import { BuildService } from '@plugin/src/services/build-service';
import type { IBuildSourceInput } from '@plugin/src/services/interfaces/build-source-input.interface';

export class BuildSourceSyncHook {
  static readonly EVENT = 'sources:sync';

  static register(context: PluginContext, buildService: BuildService): void {
    context.hooks.on(BuildSourceSyncHook.EVENT, async (payload: unknown) => {
      const sources = BuildSourceSyncHook.readSources(payload);
      const syncedSources = await buildService.syncSources(sources);
      return {
        syncedCount: syncedSources.length,
        sources: syncedSources,
      };
    });
  }

  private static readSources(payload: unknown): IBuildSourceInput[] {
    const record = payload as { sources?: IBuildSourceInput[] } | null;
    if (!record || !Array.isArray(record.sources)) {
      return [];
    }

    return record.sources;
  }
}