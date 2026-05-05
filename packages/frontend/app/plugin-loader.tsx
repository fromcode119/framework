"use client";

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ContextHooks } from '@fromcode119/react';
import { ApiPathUtils } from '@fromcode119/core/client';
import { FrontendApiBaseUrl } from '@/lib/api-base-url';

export default function PluginLoader() {
  const { plugins, activeTheme, api, isReady } = ContextHooks.usePlugins();
  const apiUrl =
    (typeof api?.getBaseUrl === 'function' && api.getBaseUrl()) ||
    FrontendApiBaseUrl.resolveFrontendApiBaseUrl();
  const theme = activeTheme;
  const pluginList = Array.isArray(plugins) ? plugins : [];
  const loadedModulesRef = useRef<Set<string>>(new Set());
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isReady) return;

    if (theme?.slug) {
      const themeCss = Array.isArray(theme?.ui?.css) ? theme.ui.css : [];
      themeCss.forEach((style: string) => {
        const href = style.startsWith('http') ? style : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, style);
        if (document.head.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      });

    }

    // Plugin/theme ESM bundles import bare specifiers (e.g. @fromcode119/react).
    // Wait until BOTH the runtime import map script tag exists AND the react bridge
    // registry entry is populated. The script tag is created synchronously inside
    // installRuntimeBridge(), but we double-check the registry to guard against any
    // edge-case where the tag was created before the bridge object was written.
    const importMapScript = document.getElementById('fc-runtime-import-map') as HTMLScriptElement | null;
    const importMapText = String(importMapScript?.textContent || '');
    const importMapReady =
      !!importMapScript &&
      importMapText.includes('"react"') &&
      importMapText.includes('useInsertionEffect') &&
      importMapText.includes('useSyncExternalStore') &&
      importMapText.includes('@fromcode119/sdk/react') &&
      !!(window as any).__fromcodeRuntimeModules?.['@fromcode119/react'] &&
      !!(window as any).__fromcodeRuntimeModules?.['@fromcode119/sdk/react'];
    if (!importMapReady) {
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

    for (const plugin of pluginList) {
      const injections = Array.isArray(plugin?.ui?.headInjections) ? plugin.ui.headInjections : [];
      for (const injection of injections) {
        const tag = String(injection?.tag || '').trim().toLowerCase();
        if (!tag) continue;

        const props = (injection?.props && typeof injection.props === 'object') ? injection.props : {};
        const uniqueKey =
          props.id ||
          props.src ||
          props.href ||
          props.name;

        if (uniqueKey) {
          const selector = `${tag}[id="${uniqueKey}"], ${tag}[src="${uniqueKey}"], ${tag}[href="${uniqueKey}"], ${tag}[name="${uniqueKey}"]`;
          if (document.head.querySelector(selector)) continue;
        }

        const element = document.createElement(tag);
        Object.entries(props).forEach(([key, rawValue]) => {
          let value = String(rawValue);
          if ((key === 'src' || key === 'href') && value.startsWith('/plugins/')) {
            value = `${apiUrl}${value}`;
          }
          element.setAttribute(key, value);
        });
        document.head.appendChild(element);
      }
    }

    const loadModule = async (moduleKey: string, moduleUrl: string) => {
      if (!moduleUrl || loadedModulesRef.current.has(moduleKey)) return;
      try {
        await import(/* webpackIgnore: true */ moduleUrl);
        loadedModulesRef.current.add(moduleKey);
      } catch (err) {
        console.error(`[frontend] Failed to import runtime module ${moduleKey}:`, err);
      }
    };

    // Load active theme runtime after import map is registered.
    if (theme?.slug) {
      const themeEntry = String(theme?.ui?.entry || '').trim();
      if (themeEntry) {
        const themeEntryUrl = themeEntry.startsWith('http')
          ? themeEntry
          : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, themeEntry);
        const themeModuleKey = `theme:${theme.slug}:${themeEntry}`;
        void loadModule(themeModuleKey, themeEntryUrl);
      }
    }

    // Load plugin runtime modules after import map is registered.
    // Only load plugins with the 'frontend' capability — admin-only plugins have no
    // frontend-visible slots and should not bloat the public page JS payload.
    // Plugins with loadStrategy "idle" are deferred until the browser is idle.
    // Plugins with loadStrategy "none" are skipped entirely on the frontend.
    pluginList.forEach((plugin: any) => {
      if (!plugin?.ui?.entry) return;
      const caps: string[] = Array.isArray(plugin.capabilities) ? plugin.capabilities : [];
      if (caps.length > 0 && !caps.includes('frontend')) return;

      const entryFile = String(plugin.ui.frontendEntry || plugin.ui.entry).trim();
      const moduleUrl = ApiPathUtils.pluginUiAssetUrl(apiUrl, plugin.slug, entryFile);
      const key = `plugin:${plugin.slug}:${entryFile}`;
      const strategy = String(plugin?.ui?.loadStrategy || 'eager').trim();

      if (strategy === 'none') return;

      if (strategy === 'idle') {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => void loadModule(key, moduleUrl), { timeout: 5000 });
        } else {
          setTimeout(() => void loadModule(key, moduleUrl), 2000);
        }
      } else {
        void loadModule(key, moduleUrl);
      }
    });

    // Ensure plugin-provided CSS is mounted (idempotent).
    pluginList.forEach((plugin: any) => {
      const css = plugin?.ui?.css;
      if (!css) return;
      const cssList = Array.isArray(css) ? css : [css];
      cssList.forEach((style: string) => {
        const href = ApiPathUtils.pluginUiAssetUrl(apiUrl, plugin.slug, style);
        if (document.head.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      });
    });

  }, [pluginList, apiUrl, isReady, retryTick, theme]);

  return null;
}
