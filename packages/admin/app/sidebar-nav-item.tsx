"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { NavItemView } from './sidebar-nav-item-view';
import type { NavItemProps } from './sidebar-nav-item.interfaces';

/**
 * Thin functional shim — the only job is to read the `usePathname()` hook and hand its value to
 * the hook-free {@link NavItemView} class, which holds the `expanded` state and all effects.
 */
export function NavItem(props: NavItemProps) {
  const pathname = usePathname();
  return <NavItemView {...props} rawPathname={pathname} />;
}
