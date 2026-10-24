import type { ReactNode } from 'react';
import { ContextHooks } from '@fromcode119/react';
import { usePathname } from 'next/navigation';
import { Bridge, prop } from '@fromcode119/react-class-components';
import { AuthHooks } from '@/components/view/use-auth.client';
import { AppearanceShellHost } from '@/app/components/view/appearance-shell-host.client';
import { AppearanceNavProjectionService } from '@/app/services/appearance-nav-projection-service';
import type { IAppearanceShellHostBridgeValues } from '@/app/interfaces/appearance-shell-host-bridge-values.interface';

/**
 * Hook→class bridge: reads the plugin-driven menu, the secondary panel, the signed-in user and the
 * current path via hooks and forwards a read-only `nav` model as props to the hook-free
 * AppearanceShellHost, so a custom appearance shell can render real navigation without recomputing it.
 * Both lists are already held to the rules the default sidebar applies, so a shell never offers a screen
 * the person's role does not open. The default shell ignores `nav`, so this changes nothing when no
 * appearance shell is active.
 */
export class AppearanceShellHostShim extends Bridge<IAppearanceShellHostBridgeValues> {
  @prop declare children: ReactNode;

  protected read(): IAppearanceShellHostBridgeValues {
    const plugins = ContextHooks.usePlugins();
    return {
      menuItems: plugins.menuItems,
      secondaryPanel: plugins.secondaryPanel,
      user: AuthHooks.useAuth().user,
      pathname: usePathname() ?? '',
    };
  }

  protected present({ menuItems, secondaryPanel, user, pathname }: IAppearanceShellHostBridgeValues): ReactNode {
    const nav = AppearanceNavProjectionService.authorized(menuItems, secondaryPanel, user, pathname);
    return <AppearanceShellHost nav={nav}>{this.children}</AppearanceShellHost>;
  }
}
