import type React from 'react';
import type { AppearanceShellProps, AppearanceShellUser } from './appearance-shell-props.interfaces';

/**
 * Props for the shared appearance security gate. The gate runs the framework's auth state and renders
 * the security/loading screens itself, then renders the given presentation `Shell` (with the nav/user
 * model) only for an authed admin on a normal page — so appearance shells stay presentation-only.
 */
export interface AppearanceSecurityGateProps {
  Shell: React.ComponentType<AppearanceShellProps>;
  nav?: AppearanceShellProps['nav'];
  user?: AppearanceShellUser;
  children: React.ReactNode;
}
