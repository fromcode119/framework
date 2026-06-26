import type React from 'react';

/**
 * A primary navigation entry handed to an appearance shell so it can render real navigation without
 * recomputing the framework's plugin-driven menu. A read-only projection of the admin's menu.
 */
export interface AppearanceNavItem {
  path: string;
  label: string;
  icon?: string;
  group?: string;
  pluginSlug?: string;
  children?: AppearanceNavItem[];
}

/** The authed admin user, passed read-only so an appearance shell can render account chrome. */
export interface AppearanceShellUser {
  email: string;
  name?: string;
  roles?: string[];
}

/**
 * Props passed to an appearance shell — it wraps the routed admin page as `children`.
 *
 * `nav` and `user` are OPTIONAL and ADDITIVE. The default `ClientLayoutShell` ignores them and stays
 * byte-for-byte unchanged; a custom appearance shell (e.g. Nexora) consumes them to render real
 * navigation + account chrome WITHOUT reimplementing the framework's auth or navigation logic.
 */
export interface AppearanceShellProps {
  children: React.ReactNode;
  nav?: {
    items: AppearanceNavItem[];
    activePath: string;
  };
  user?: AppearanceShellUser;
}
