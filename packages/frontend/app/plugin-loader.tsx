"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ContextHooks } from '@fromcode119/react';
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
  const getPluginUiAssetUrl = (pluginSlug: string, asset: string) =>
    `${apiUrl}/plugins/${pluginSlug}/ui/${asset}`;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isReady) return;

    // Plugin/theme ESM bundles import bare specifiers (e.g. @fromcode119/react).
    // Wait until BOTH the runtime import map script tag exists AND the react bridge
    // registry entry is populated. The script tag is created synchronously inside
    // installRuntimeBridge(), but we double-check the registry to guard against any
    // edge-case where the tag was created before the bridge object was written.
    const importMapReady =
      !!document.getElementById('fc-runtime-import-map') &&
      !!(window as any).__fromcodeRuntimeModules?.['@fromcode119/react'];
    if (!importMapReady) {
      const timer = window.setTimeout(() => setRetryTick((v) => v + 1), 50);
      return () => window.clearTimeout(timer);
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

    // Load plugin runtime modules after import map is registered.
    pluginList.forEach((plugin: any) => {
      if (!plugin?.ui?.entry) return;
      const moduleUrl = getPluginUiAssetUrl(plugin.slug, plugin.ui.entry);
      void loadModule(`plugin:${plugin.slug}:${plugin.ui.entry}`, moduleUrl);
    });

    // Ensure plugin-provided CSS is mounted (idempotent).
    pluginList.forEach((plugin: any) => {
      const css = plugin?.ui?.css;
      if (!css) return;
      const cssList = Array.isArray(css) ? css : [css];
      cssList.forEach((style: string) => {
        const href = getPluginUiAssetUrl(plugin.slug, style);
        if (document.head.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      });
    });

    // Theme assets are loaded by loadConfig() in PluginsProvider.
    // Keep PluginLoader focused on plugin runtime modules to avoid duplicate theme imports.
  }, [pluginList, apiUrl, isReady, retryTick, theme]);

  return null;
}
