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
    entryUrl?: string;
    css?: string[];
    cssUrls?: string[];
  };
}

export default function PluginLoader() {
  const pluginsContext = usePlugins();
  const { registerSlotComponent, registerMenuItem, registerCollection, registerSettings, registerPlugins, refreshVersion, triggerRefresh } = pluginsContext;
  const { user, isLoading: isAuthLoading } = useAuth();
  const [loaded, setLoaded] = useState(false);

  // Hot Module Replacement Listener
  useEffect(() => {
    if (typeof window === 'undefined' || !user || process.env.NODE_ENV !== 'development') return;

    console.log("[HMR] Initializing EventSource connection...");
    const eventSource = new EventSource(`${API_BASE_URL}${ENDPOINTS.SYSTEM.EVENTS}`, {
        withCredentials: true
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'plugin:ui:reload') {
          console.log(`[HMR] Changes detected in ${data.slug}. Triggering UI refresh...`);
          // Note: triggerRefresh clears existing slots/menu items and increments refreshVersion
          // which causes the main loader effect to re-run.
          triggerRefresh();
        }
      } catch (err) {
        console.error("[HMR] Failed to parse event data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("[HMR] EventSource connection lost. Retrying...", err);
    };

    return () => {
      console.log("[HMR] Closing EventSource connection...");
      eventSource.close();
    };
  }, [user, triggerRefresh]);

  useEffect(() => {
    console.debug("[Admin] PluginLoader Effect triggered", { 
      hasRegisterPlugins: typeof registerPlugins === 'function',
      keys: Object.keys(pluginsContext),
      refreshVersion
    });

    if (typeof window === 'undefined' || isAuthLoading || !user) return;

    async function loadPlugins() {
      // Small delay to ensure GlobalInitializer has run
      // and window.FrameworkIcons, window.React, window.ReactDOM are available
      let retryCount = 0;
      while (
        (!(window as any).FrameworkIcons || 
         !(window as any).React || 
         !(window as any).Lucide ||
         !(window as any).Fromcode?.isReady) && 
        retryCount < 100
      ) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retryCount++;
      }

      if (!(window as any).FrameworkIcons || !(window as any).React || !(window as any).Fromcode?.isReady) {
        console.error("[Admin] Required globals not found on window. Plugin loading aborted.", {
          icons: !!(window as any).FrameworkIcons,
          react: !!(window as any).React,
          lucide: !!(window as any).Lucide,
          bridge: !!(window as any).Fromcode?.isReady
        });
        return;
      }

      try {
        const responseData = await api.get(ENDPOINTS.PLUGINS.STAGED);
        const plugins: AdminPluginMetadata[] = responseData.plugins || [];
        const remoteMenu: any[] = responseData.menu || [];
        const settings: Record<string, any> = responseData.settings || {};

        if (settings) {
          registerSettings(settings);
        }

        if (Array.isArray(plugins)) {
          registerPlugins(plugins);
          for (const plugin of plugins) {
            // Load UI entry points if defined (Phase 4)
            const entryUrl = plugin.ui?.entryUrl;
            if (entryUrl) {
              const cacheBreaker = refreshVersion > 0 ? `?v=${refreshVersion}` : '';
              const src = `${API_BASE_URL}${entryUrl}${cacheBreaker}`;
              
              // 1. Module Preload (only if it doesn't exist)
              if (!document.querySelector(`link[href="${src}"][rel="modulepreload"]`)) {
                // Remove old reloads
                const oldPreloads = document.querySelectorAll(`link[rel="modulepreload"][data-plugin="${plugin.slug}"]`);
                oldPreloads.forEach(el => el.remove());

                const link = document.createElement('link');
                link.rel = 'modulepreload';
                link.href = src;
                link.setAttribute('data-plugin', plugin.slug);
                document.head.appendChild(link);
              }

              // 2. Dynamic Import to handle both side-effects and structured exports (slots)
              import(/* webpackIgnore: true */ src).then(module => {
                if (module.init) module.init();
                
                // If the module exports a "slots" object, register them automatically
                if (module.slots) {
                  Object.entries(module.slots).forEach(([slotName, config]: [string, any]) => {
                    const component = typeof config === 'function' ? config : config.component;
                    const priority = config.priority || 0;
                    registerSlotComponent(slotName, component, plugin.slug, priority);
                  });
                }
                
                console.log(`[Admin] Plugin ${plugin.slug} UI module loaded and initialized. (ver: ${refreshVersion})`);
              }).catch(err => {
                console.warn(`[Admin] Failed to dynamic import plugin ${plugin.slug}:`, err);
                
                // Fallback: regular script tag if import fails (legacy or side-effect only)
                if (!document.querySelector(`script[src="${src}"]`)) {
                   // Remove old reloads
                   const oldScripts = document.querySelectorAll(`script[data-plugin="${plugin.slug}"][data-type="ui-entry"]`);
                   oldScripts.forEach(el => el.remove());

                  const script = document.createElement('script');
                  script.type = 'module';
                  script.src = src;
                  script.async = true;
                  script.setAttribute('data-plugin', plugin.slug);
                  script.setAttribute('data-type', 'ui-entry');
                  document.body.appendChild(script);
                }
              });
            }

            // Load CSS if defined
            if (plugin.ui?.cssUrls) {
              plugin.ui.cssUrls.forEach((cssUrl, index) => {
                const cacheBreaker = refreshVersion > 0 ? `?v=${refreshVersion}` : '';
                const href = `${API_BASE_URL}${cssUrl}${cacheBreaker}`;
                
                if (!document.querySelector(`link[href="${href}"]`)) {
                  // Remove old CSS versions
                  const oldCSS = document.querySelectorAll(`link[rel="stylesheet"][data-plugin="${plugin.slug}"][data-index="${index}"]`);
                  oldCSS.forEach(el => el.remove());

                  const link = document.createElement('link');
                  link.rel = 'stylesheet';
                  link.href = href;
                  link.setAttribute('data-plugin', plugin.slug);
                  link.setAttribute('data-index', index.toString());
                  document.head.appendChild(link);
                }
              });
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
  }, [user, isAuthLoading, registerSlotComponent, registerMenuItem, registerCollection, registerPlugins, registerSettings, refreshVersion, triggerRefresh]);

  return null;
}
