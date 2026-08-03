import type React from 'react';
import type { IAppearanceNavItem } from '@/lib/appearance/interfaces/appearance-nav-item.interface';
import type { IAppearanceShellUser } from '@/lib/appearance/interfaces/appearance-shell-user.interface';

/**
 * Props passed to an appearance shell — it wraps the routed admin page as `children`.
 *
 * `nav` and `user` are OPTIONAL and ADDITIVE. The default `ClientLayoutShell` ignores them and stays
 * byte-for-byte unchanged; a custom appearance shell (e.g. Nexora) consumes them to render real
 * navigation + account chrome WITHOUT reimplementing the framework's auth or navigation logic.
 */
export interface IAppearanceShellProps {
  children: React.ReactNode;
  nav?: {
    items: IAppearanceNavItem[];
    activePath: string;
  };
  user?: IAppearanceShellUser;
}
