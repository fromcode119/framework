import type { PluginDetailPageController } from '@/app/plugins/[slug]/plugin-detail-page-controller';

/** Hook values the {@link PluginDetailPage} bridge reads and forwards to its view. */
export interface IPluginDetailPageValues {
  slug: string;
  model: ReturnType<typeof PluginDetailPageController.useModel>;
}
