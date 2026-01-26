"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePlugins } from '@fromcode/react';
import { api } from '@/lib/api';
import { ENDPOINTS, API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@/components/AuthContext';

interface AdminPluginMetadata {
  slug: string;
  name: string;
  admin?: {
    slots?: Array<{
      slot: string;
      component: string;
      file: string;
      priority: number;
    }>;
    menu?: Array<{
      label: string;
      path: string;
      icon: string;
    }>;
    collections?: Array<{
      slug: string;
      name?: string;
      fields: any[];
      admin?: any;
    }>;
  };
  ui?: {
    entry?: string;
    css?: string[];
  };
}

export default function PluginLoader() {
  const { registerSlotComponent, registerMenuItem, registerCollection, refreshVersion } = usePlugins();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || isAuthLoading || !user) return;

    async function loadPlugins() {
      // Small delay to ensure GlobalInitializer has run
      // and window.FrameworkIcons, window.React, window.ReactDOM are available
      let retryCount = 0;
      while (!(window as any).FrameworkIcons && retryCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retryCount++;
      }

      if (!(window as any).FrameworkIcons) {
        console.error("[Admin] FrameworkIcons not found on window. Plugin loading aborted.");
        return;
      }

      try {
        const responseData = await api.get(ENDPOINTS.PLUGINS.STAGED);
        const plugins: AdminPluginMetadata[] = responseData.plugins || [];
        const remoteMenu: any[] = responseData.menu || [];

        if (Array.isArray(plugins)) {
          for (const plugin of plugins) {
            // Load UI entry points if defined (Phase 4)
            if (plugin.ui?.entry) {
              const src = `${API_BASE_URL}/plugins/${plugin.slug}/ui/${plugin.ui.entry}`;
              
              // 1. Module Preload to optimize loading and prevent "preloaded but not used" browser warnings
              if (!document.querySelector(`link[href="${src}"][rel="modulepreload"]`)) {
                const link = document.createElement('link');
                link.rel = 'modulepreload';
                link.href = src;
                document.head.appendChild(link);
              }

              // 2. Main Entry Injection
              if (!document.querySelector(`script[src="${src}"]`)) {
                const script = document.createElement('script');
                script.type = 'module';
                script.src = src;
                script.async = true;
                document.body.appendChild(script);
              }
            }

            // Load CSS if defined
            if (plugin.ui?.css) {
              for (const cssFile of plugin.ui.css) {
                const href = `${API_BASE_URL}/plugins/${plugin.slug}/ui/${cssFile}`;
                if (!document.querySelector(`link[href="${href}"]`)) {
                  const link = document.createElement('link');
                  link.rel = 'stylesheet';
                  link.href = href;
                  document.head.appendChild(link);
                }
              }
            }

            if (!plugin.admin) continue;
            
            // Register Collections (Metadata only, Sidebar uses Menu)
            if (plugin.admin.collections) {
              for (const collection of plugin.admin.collections) {
                registerCollection(collection);
              }
            }
          }
        }

        // Register Global Menu Items
        for (const menuItem of remoteMenu) {
          registerMenuItem(menuItem);
        }

        setLoaded(true);
      } catch (err) {
        console.error("Failed to load plugin metadata:", err);
      }
    }

    loadPlugins();
  }, [user, isAuthLoading, registerSlotComponent, registerMenuItem, registerCollection, refreshVersion]);

  return null;
}
