import type { PluginContext } from '@fromcode119/sdk';
import { BuildService } from '@plugin/src/services/build-service';

export class BuildSourceDeleteHook {
  static readonly EVENT = 'sources:delete';

  static register(context: PluginContext, buildService: BuildService): void {
    context.hooks.on(BuildSourceDeleteHook.EVENT, async (payload: unknown) => {
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
