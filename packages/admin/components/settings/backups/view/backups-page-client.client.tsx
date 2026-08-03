import type { ReactNode } from 'react';
import { ThemeHooks } from '@/components/view/use-theme.client';
import { Bridge } from '@fromcode119/reactor';
import { BackupsPageControllerHooks } from '@/components/settings/backups/view/backups-page-controller.client';
import { BackupsPageClientView } from '@/components/settings/backups/view/backups-page-client-view.client';
import type { IBackupsPageBridgeValues } from '@/components/settings/backups/interfaces/backups-page-bridge-values.interface';

/**
 * Hook→class bridge — reads the theme + controller hooks and hands their values to the
 * hook-free {@link BackupsPageClientView} class, which holds the (purely presentational) render.
 */
export class BackupsPageClient extends Bridge<IBackupsPageBridgeValues> {
  protected read(): IBackupsPageBridgeValues {
    return { theme: ThemeHooks.useTheme().theme, controller: BackupsPageControllerHooks.useController() };
  }

  protected present({ theme, controller }: IBackupsPageBridgeValues): ReactNode {
    return <BackupsPageClientView theme={theme} controller={controller} />;
  }
}
