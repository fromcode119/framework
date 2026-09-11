import type { HookManager } from '@fromcode119/core';
import { BuildService } from '@sources/services/build-service';

export class BuildTriggerHook {
  static readonly EVENT = 'sources:builds:trigger';

  static register(hooks: HookManager, buildService: BuildService): void {
    hooks.on(BuildTriggerHook.EVENT, async (payload: unknown) => {
      const slug = BuildTriggerHook.readSlug(payload);
      if (!slug) {
        const results = await buildService.buildAll();
        return { results, success: true };
      }

      const result = await buildService.buildBySlug(slug);
      return { result, success: result.success };
    });
  }

  private static readSlug(payload: unknown): string {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
    return typeof record?.slug === 'string' ? record.slug.trim() : '';
  }
}
