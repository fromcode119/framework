import type { HookManager } from '@fromcode119/core';
import { BuildService } from '@sources/packaging/build-service';
import type { IBuildSourceInput } from '@sources/sources/interfaces/build-source-input.interface';

export class BuildSourceSyncHook {
  static readonly EVENT = 'sources:sync';

  static register(hooks: HookManager, buildService: BuildService): void {
    hooks.on(BuildSourceSyncHook.EVENT, async (payload: unknown) => {
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