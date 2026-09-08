import type { ReactNode } from 'react';
import { ThemeHooks } from '@/components/view/use-theme.client';
import { AuthHooks } from '@/components/view/use-auth.client';
import { PlatformOnlyPanel } from '@/components/view/platform-only-panel.client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
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
    return {
      theme: ThemeHooks.useTheme().theme,
      controller: BackupsPageControllerHooks.useController(),
      canManagePlatform: PlatformAccess.canManagePlatform(AuthHooks.useAuth().user),
    };
  }

  protected present({ theme, controller, canManagePlatform }: IBackupsPageBridgeValues): ReactNode {
    // A system backup is the WHOLE database — every site on this container — and a restore overwrites
    // all of them. A site's own data leaves through its export on Sites, which is a different scope.
    if (!canManagePlatform) {
      return (
        <PlatformOnlyPanel detail="A system backup contains every site on this platform, and restoring one overwrites all of them, so only a platform admin can take or restore them. Your own site's content is exported from Sites." />
      );
    }
    return <BackupsPageClientView theme={theme} controller={controller} />;
  }
}
