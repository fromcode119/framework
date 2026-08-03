import type { ThemeHooks } from '@/components/view/use-theme.client';
import type { BackupsPageControllerHooks } from '@/components/settings/backups/view/backups-page-controller.client';

/** Hook values the {@link BackupsPageClient} bridge reads and forwards to its view. */
export interface IBackupsPageBridgeValues {
  theme: ReturnType<typeof ThemeHooks.useTheme>['theme'];
  controller: ReturnType<typeof BackupsPageControllerHooks.useController>;
}
