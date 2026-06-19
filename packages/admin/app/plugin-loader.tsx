"use client";

import React, { useEffect } from 'react';
import { ContextHooks } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AuthHooks } from '@/components/use-auth';
import { GlobalReadinessService } from '@/lib/global-readiness-service';
import { PluginMetadataBootstrapService } from './services/plugin-metadata-bootstrap-service';
import { PluginAssetLoaderService } from './services/plugin-asset-loader-service';
import type { AdminPluginMetadata } from './plugin-loader.interfaces';

let crossOriginEventsWarningLogged = false;

// Prevents multiple concurrent "globals not ready" retry timers from accumulating.
let globalRetryTimerId: ReturnType<typeof setTimeout> | null = null;

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
    const abortController = new AbortController();

    async function loadPlugins() {
      if (!isReady) {
        await PluginMetadataBootstrapService.ensureLoaded(loadConfig);
        return;
      }

      try {
        await GlobalReadinessService.waitForReady(abortController.signal);
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error('[Admin] Required globals not ready. Scheduling retry.', err);
        if (!globalRetryTimerId) {
          globalRetryTimerId = setTimeout(() => {
            globalRetryTimerId = null;
            if (!cancelled) triggerRefresh();
          }, 3000);
        }
        return;
      }

      if (cancelled) return;

      try {
        const shouldReuseContextMetadata = refreshVersion === 0 && Array.isArray(registeredPlugins) && registeredPlugins.length > 0;
        if (!shouldReuseContextMetadata) {
          await PluginMetadataBootstrapService.ensureLoaded(loadConfig);
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
          PluginAssetLoaderService.apply({
            plugins,
            refreshVersion,
            callbacks: { registerSlotComponent, registerCollection, replaceCollections },
          });
        }

      } catch (err) {
        console.error("Failed to load plugin metadata:", err);
      }
    }

    loadPlugins();

    return () => {
      cancelled = true;
      abortController.abort();
      if (globalRetryTimerId) {
        clearTimeout(globalRetryTimerId);
        globalRetryTimerId = null;
      }
    };
  }, [user, isAuthLoading, isReady, loadConfig, registerSlotComponent, registerCollection, replaceCollections, registerPlugins, registerSettings, refreshVersion]);

  return null;
}
