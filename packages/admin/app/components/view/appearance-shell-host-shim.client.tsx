import type { ReactNode } from 'react';
import { ContextHooks } from '@fromcode119/react';
import { usePathname } from 'next/navigation';
import { Bridge, prop } from '@fromcode119/reactor';
import { AppearanceShellHost } from '@/app/components/view/appearance-shell-host.client';
import { AppearanceNavProjectionService } from '@/app/services/appearance-nav-projection-service';
import type { IAppearanceShellHostBridgeValues } from '@/app/interfaces/appearance-shell-host-bridge-values.interface';

/**
 * Hook→class bridge: reads the plugin-driven menu + current path via hooks and forwards a read-only
 * `nav` model as props to the hook-free AppearanceShellHost, so a custom appearance shell can render
 * real navigation without recomputing it. The default shell ignores `nav`, so this changes nothing
 * when no appearance shell is active.
 */
export class AppearanceShellHostShim extends Bridge<IAppearanceShellHostBridgeValues> {
  @prop declare children: ReactNode;

  protected read(): IAppearanceShellHostBridgeValues {
    return { menuItems: ContextHooks.usePlugins().menuItems, pathname: usePathname() ?? '' };
  }

  protected present({ menuItems, pathname }: IAppearanceShellHostBridgeValues): ReactNode {
    const nav = { items: AppearanceNavProjectionService.project(menuItems), activePath: pathname };
    return <AppearanceShellHost nav={nav}>{this.children}</AppearanceShellHost>;
  }
}
