"use client";

import React from 'react';
import { ContextHooks } from '@fromcode119/react';
import { usePathname } from 'next/navigation';
import AppearanceShellHost from './appearance-shell-host';
import type { ClientLayoutChildrenProps } from './client-layout.interfaces';
import { AppearanceNavProjectionService } from './services/appearance-nav-projection-service';

/**
 * Thin functional shim (the sanctioned hook→class bridge): reads the plugin-driven menu + current
 * path via hooks and forwards a read-only `nav` model as props to the hook-free AppearanceShellHost,
 * so a custom appearance shell can render real navigation without recomputing it. The default shell
 * ignores `nav`, so this changes nothing when no appearance shell is active.
 */
export default function AppearanceShellHostShim({ children }: ClientLayoutChildrenProps) {
  const { menuItems } = ContextHooks.usePlugins();
  const pathname = usePathname() ?? '';
  const nav = React.useMemo(
    () => ({ items: AppearanceNavProjectionService.project(menuItems), activePath: pathname }),
    [menuItems, pathname],
  );
  return <AppearanceShellHost nav={nav}>{children}</AppearanceShellHost>;
}
