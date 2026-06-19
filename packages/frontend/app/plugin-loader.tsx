"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ContextHooks } from '@fromcode119/react';
import { FrontendApiBaseUrl } from '@/lib/api-base-url';
import { PluginLoaderMountService } from './plugin-loader-mount-service';
import { PluginLoaderThemeTracker } from './plugin-loader-theme-tracker';

export default function PluginLoader() {
  const { plugins, activeTheme, api, isReady } = ContextHooks.usePlugins();
  const apiUrl =
    (typeof api?.getBaseUrl === 'function' && api.getBaseUrl()) ||
    FrontendApiBaseUrl.resolveFrontendApiBaseUrl();
  const theme = activeTheme;
  const pluginList = Array.isArray(plugins) ? plugins : [];
  const loadedModulesRef = useRef<Set<string>>(new Set());
  const previousPluginOwnersRef = useRef<Array<{ namespace: string; pluginSlug: string }>>([]);
  const previousThemeSlugRef = useRef('');
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    PluginLoaderThemeTracker.reconcile({
      pluginList,
      themeSlug: theme?.slug,
      previousThemeSlugRef,
      previousPluginOwnersRef,
    });
  }, [pluginList, theme?.slug]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isReady) return;

    PluginLoaderMountService.mountThemeCss(theme, apiUrl);

    if (!PluginLoaderMountService.isImportMapReady()) {
      // Primary trigger: event dispatched by ImportMapInstaller when import map is written.
      const handler = () => setRetryTick((v) => v + 1);
      window.addEventListener('fromcode:import-map-ready', handler, { once: true });
      // Fallback poll every 50ms in case the event was already fired before this effect ran.
      const timer = window.setTimeout(() => setRetryTick((v) => v + 1), 50);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('fromcode:import-map-ready', handler);
      };
    }

    PluginLoaderMountService.mountHeadInjections(pluginList, apiUrl);

    const loadModule = async (moduleKey: string, moduleUrl: string) => {
      if (!moduleUrl || loadedModulesRef.current.has(moduleKey)) return;
      try {
        await import(/* webpackIgnore: true */ moduleUrl);
        loadedModulesRef.current.add(moduleKey);
      } catch (err) {
        console.error(`[frontend] Failed to import runtime module ${moduleKey}:`, err);
      }
    };

    PluginLoaderMountService.loadThemeRuntime(theme, apiUrl, loadModule);
    PluginLoaderMountService.loadPluginRuntimes(pluginList, apiUrl, loadModule);
    PluginLoaderMountService.mountPluginCss(pluginList, apiUrl);

  }, [pluginList, apiUrl, isReady, retryTick, theme]);

  return null;
}
