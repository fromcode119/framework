import type { NavItemProps } from './sidebar-nav-item.interfaces';

export interface NavItemViewProps extends NavItemProps {
  /** Raw pathname from `usePathname()`, supplied by the thin functional shim. */
  rawPathname: string | null;
}

export interface NavItemViewState {
  expanded: boolean;
}
