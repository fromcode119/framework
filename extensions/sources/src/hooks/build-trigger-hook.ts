import type { PluginContext } from '@fromcode119/sdk';
import { BuildService } from '@plugin/src/services/build-service';

export class BuildTriggerHook {
  static readonly EVENT = 'sources:builds:trigger';

  static register(context: PluginContext, buildService: BuildService): void {
    context.hooks.on(BuildTriggerHook.EVENT, async (payload: unknown) => {
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
