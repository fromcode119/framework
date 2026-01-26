"use client";

import React, { forwardRef, createElement, ReactNode } from 'react';

/**
 * Creates a stable React component that proxies to a global LucideIcons registry.
 * This allows icons to be used before Lucide is fully loaded and handles
 * dynamic icon discovery.
 */
export function createProxyIcon(name: string) {
  const ProxyIcon = forwardRef((props: any, ref) => {
    // Look up in the global semantic registry provided by the framework
    const Registry = (window as any).FrameworkIcons;
    const Icon = Registry ? Registry[name] : null;
    
    if (!Icon) {
      // Return null to avoid breaking layout if icon is missing
      return null;
    }
    
    return createElement(Icon, { ...props, ref });
  });

  ProxyIcon.displayName = `FrameworkIcon.${name}`;
  return ProxyIcon;
}

/**
 * Hook or helper to get an icon component by name dynamicallly
 */
export const getIcon = (name: string) => {
    if (!(window as any)._iconCache) (window as any)._iconCache = new Map();
    const cache = (window as any)._iconCache;
    
    if (cache.has(name)) return cache.get(name);
    
    const Component = createProxyIcon(name);
    cache.set(name, Component);
    return Component;
};
