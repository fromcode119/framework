import type { HookManager } from '@fromcode119/core';
import { BuildService } from '@sources/build/build-service';

export class BuildSourceDeleteHook {
  static readonly EVENT = 'sources:delete';

  static register(hooks: HookManager, buildService: BuildService): void {
    hooks.on(BuildSourceDeleteHook.EVENT, async (payload: unknown) => {
      const slug = BuildSourceDeleteHook.readSlug(payload);
      if (!slug) {
        return { success: false };
      }

      await buildService.deleteSource(slug);
      return { success: true };
    });
  }

  private static readSlug(payload: unknown): string {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
    return typeof record?.slug === 'string' ? record.slug.trim() : '';
  }
}
