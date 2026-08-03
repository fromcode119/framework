import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Bridge } from '@fromcode119/reactor';
import { NavItemView } from '@/app/components/view/sidebar-nav-item-view.client';
import type { INavItemProps } from '@/app/interfaces/nav-item-props.interface';
import type { INavItemBridgeValues } from '@/app/interfaces/nav-item-bridge-values.interface';

/**
 * Hook→class bridge — the only job is to read the `usePathname()` hook and hand its value to
 * the hook-free {@link NavItemView} class, which holds the `expanded` state and all effects.
 */
export class NavItem extends Bridge<INavItemBridgeValues, INavItemProps> {
  protected read(): INavItemBridgeValues {
    return { pathname: usePathname() };
  }

  protected present({ pathname }: INavItemBridgeValues): ReactNode {
    return <NavItemView {...this.props} rawPathname={pathname} />;
  }
}
