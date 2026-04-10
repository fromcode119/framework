"use client";

import React, { useEffect } from 'react';
import { ContextHooks } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AuthHooks } from '@/components/use-auth';
import { RuntimeConstants } from '@fromcode119/core/client';
import type { AdminPluginMetadata } from './plugin-loader.interfaces';

const METADATA_RETRY_COOLDOWN_MS = 15000;

let metadataBootstrapPromise: Promise<void> | null = null;
let metadataBootstrapError: unknown = null;
let metadataBootstrapRetryAfter = 0;
let crossOriginEventsWarningLogged = false;

// Prevents multiple concurrent "globals not ready" retry timers from accumulating.
let globalRetryTimerId: ReturnType<typeof setTimeout> | null = null;

async function ensureMetadataLoaded(loadConfig: (path?: string) => Promise<any>): Promise<void> {
  const now = Date.now();

  if (metadataBootstrapPromise) {
    return metadataBootstrapPromise;
  }

  if (metadataBootstrapError && metadataBootstrapRetryAfter > now) {
    throw metadataBootstrapError;
  }

  metadataBootstrapPromise = loadConfig(AdminConstants.ENDPOINTS.SYSTEM.METADATA)
    .then(() => {
      metadataBootstrapError = null;
      metadataBootstrapRetryAfter = 0;
    })
    .catch((error) => {
      metadataBootstrapError = error;
      metadataBootstrapRetryAfter = Date.now() + METADATA_RETRY_COOLDOWN_MS;
      throw error;
    })
    .finally(() => {
      metadataBootstrapPromise = null;
    });

  return metadataBootstrapPromise;
}

export default function PluginLoader() {
  const pluginsContext = ContextHooks.usePlugins();
  const {
    plugins: registeredPlugins,
    settings: registeredSettings,
    loadConfig,
    registerSlotComponent,
    registerCollection,
    replaceCollections,
    registerSettings,
    registerPlugins,
    refreshVersion,
    triggerRefresh,
    isReady,
  } = pluginsContext;
  const { user, isLoading: isAuthLoading } = AuthHooks.useAuth();

  // Hot Module Replacement Listener
  useEffect(() => {
    if (typeof window === 'undefined' || !user || process.env.NODE_ENV !== 'development') return;

    const eventsUrl = new URL(AdminConstants.ENDPOINTS.SYSTEM.EVENTS, AdminConstants.API_BASE_URL || window.location.origin);
    const eventSourceUrl = eventsUrl.origin === window.location.origin
      ? eventsUrl.pathname + eventsUrl.search
      : eventsUrl.toString();

    if (eventsUrl.origin !== window.location.origin && !crossOriginEventsWarningLogged) {
      crossOriginEventsWarningLogged = true;
      console.info(`[HMR] Using cross-origin EventSource bridge in development from ${window.location.origin} to ${eventsUrl.origin}.`);
    }

    const eventSource = new EventSource(eventSourceUrl, {
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

    eventSource.onerror = () => {
      console.warn('[HMR] EventSource connection lost. Closing dev stream until the next page refresh.');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [user, triggerRefresh]);

  useEffect(() => {
    if (typeof window === 'undefined' || isAuthLoading || !user) return;

    let cancelled = false;

    async function loadPlugins() {
      if (!isReady) {
        await ensureMetadataLoaded(loadConfig);
        return;
      }

      const resolveAdminComponentsModule = () => {
        const runtimeRegistry = (window as any)?.[RuntimeConstants.GLOBALS.MODULES] || {};
        return runtimeRegistry[RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS] || runtimeRegistry[RuntimeConstants.MODULE_NAMES.ADMIN] || null;
      };

      // Small delay to ensure GlobalInitializer has run
      // and window.FrameworkIcons, window.React, window.ReactDOM are available.
      // Also wait for the runtime import map to be installed so that plugin ESM bundles
      // can resolve bare specifiers like @fromcode119/sdk/react.
      let retryCount = 0;
      while (
        (!(window as any).FrameworkIcons || 
         !(window as any).React || 
         !(window as any).Lucide ||
         !(window as any).Fromcode ||
         !resolveAdminComponentsModule() ||
         typeof resolveAdminComponentsModule()?.Select === 'undefined' ||
         !document.getElementById('fc-runtime-import-map') ||
         !(window as any).__fromcodeRuntimeModules?.['@fromcode119/react']) && 
        retryCount < 200 &&
        !cancelled
      ) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retryCount++;
      }

      if (cancelled) return;

      const adminComponentsModule = resolveAdminComponentsModule();

      if (
        !(window as any).FrameworkIcons ||
        !(window as any).React ||
        !(window as any).Lucide ||
        !(window as any).Fromcode ||
        !adminComponentsModule ||
        typeof adminComponentsModule.Select === 'undefined' ||
        !document.getElementById('fc-runtime-import-map') ||
        !(window as any).__fromcodeRuntimeModules?.['@fromcode119/react']
      ) {
        console.error("[Admin] Required globals not found on window. Plugin loading aborted.", {
          icons: !!(window as any).FrameworkIcons,
          react: !!(window as any).React,
          lucide: !!(window as any).Lucide,
          bridge: !!(window as any).Fromcode,
          adminBridge: !!adminComponentsModule,
          select: typeof adminComponentsModule?.Select !== 'undefined',
          importMap: !!document.getElementById('fc-runtime-import-map'),
          reactBridge: !!(window as any).__fromcodeRuntimeModules?.['@fromcode119/react'],
        });
        // Schedule a single deduplicated retry. The module-level guard prevents
        // multiple timers from accumulating across rapid re-renders.
        if (!globalRetryTimerId) {
          globalRetryTimerId = setTimeout(() => {
            globalRetryTimerId = null;
            if (!cancelled) triggerRefresh();
          }, 3000);
        }
        return;
      }

      try {
        const shouldReuseContextMetadata = refreshVersion === 0 && Array.isArray(registeredPlugins) && registeredPlugins.length > 0;
        if (!shouldReuseContextMetadata) {
          await ensureMetadataLoaded(loadConfig);
        }
        const responseData = shouldReuseContextMetadata
          ? {
              plugins: registeredPlugins,
              settings: registeredSettings,
            }
          : await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.STAGED);
        const plugins: AdminPluginMetadata[] = responseData.plugins || [];
        const settings: Record<string, any> = responseData.settings || {};
        const pluginSettingsBySlug = plugins.reduce((acc: Record<string, Record<string, any>>, plugin: AdminPluginMetadata) => {
          const slug = String(plugin?.slug || '').trim();
          if (!slug) return acc;
          acc[slug] = (plugin as any)?.config?.settings || {};
          return acc;
        }, {});

        if (settings) {
          registerSettings(settings);
        }

        if (Array.isArray(plugins)) {
          registerPlugins(plugins);
          const nextCollections = plugins.flatMap((plugin) =>
            Array.isArray(plugin?.admin?.collections)
              ? plugin.admin.collections.map((collection: any) => ({
                  ...collection,
                  pluginSlug: collection?.pluginSlug || plugin.slug,
                }))
              : []
          );

          if (typeof replaceCollections === 'function') {
            replaceCollections(nextCollections);
          } else {
            for (const collection of nextCollections) {
              registerCollection(collection);
            }
          }

          for (const plugin of plugins) {
            // Load UI entry points if defined (Phase 4)
            const entryUrl = plugin.ui?.entryUrl;
            if (entryUrl) {
              const cacheBreaker = refreshVersion > 0 ? `?v=${refreshVersion}` : '';
              const src = `${AdminConstants.API_BASE_URL}${entryUrl}${cacheBreaker}`;
              
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
                const href = `${AdminConstants.API_BASE_URL}${cssUrl}${cacheBreaker}`;
                console.debug(`[Admin] Loading plugin CSS from: ${href}`);
                
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
          }
        }

      } catch (err) {
        console.error("Failed to load plugin metadata:", err);
      }
    }

    loadPlugins();

    return () => {
      cancelled = true;
      if (globalRetryTimerId) {
        clearTimeout(globalRetryTimerId);
        globalRetryTimerId = null;
      }
    };
  }, [user, isAuthLoading, isReady, loadConfig, registerSlotComponent, registerCollection, replaceCollections, registerPlugins, registerSettings, refreshVersion]);

  return null;
}
