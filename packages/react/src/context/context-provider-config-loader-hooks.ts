import React from 'react';
import {
  ApplicationHostUtils,
  ApiPathUtils,
  PublicAssetUrlUtils,
} from '@fromcode119/core/client';
import type { CollectionMetadata, SecondaryPanelState } from '../context.interfaces';
import { ContextProviderStateService } from './context-provider-state-service';

export class ContextProviderConfigLoaderHooks {
  static useConfigLoader(args: {
    apiFetch: (path: string, options?: RequestInit & { silent?: boolean; noDedupe?: boolean }) => Promise<any>;
    getBaseURL: () => string;
    setServerRuntimeModules: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setPlugins: React.Dispatch<React.SetStateAction<any[]>>;
    setCollections: React.Dispatch<React.SetStateAction<CollectionMetadata[]>>;
    setMenuItems: React.Dispatch<React.SetStateAction<any[]>>;
    setSecondaryPanel: React.Dispatch<React.SetStateAction<SecondaryPanelState>>;
    setSettings: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setActiveTheme: React.Dispatch<React.SetStateAction<any>>;
    setThemeVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setIsReady: React.Dispatch<React.SetStateAction<boolean>>;
    inFlightConfigLoadsRef: React.MutableRefObject<Map<string, Promise<any>>>;
    loadedConfigPathsRef: React.MutableRefObject<Set<string>>;
  }) {
    const {
      apiFetch,
      getBaseURL,
      inFlightConfigLoadsRef,
      loadedConfigPathsRef,
      setActiveTheme,
      setCollections,
      setIsReady,
      setMenuItems,
      setPlugins,
      setSecondaryPanel,
      setServerRuntimeModules,
      setSettings,
      setThemeVariables,
    } = args;

    const loadThemeEntry = React.useCallback(async (baseUrl: string, theme: any) => {
      const themeSlug = String(theme?.slug || '').trim();
      const themeEntry = String(theme?.ui?.entry || '').trim();
      if (!themeSlug || !themeEntry || typeof document === 'undefined') {
        return;
      }

      const entryUrl = themeEntry.startsWith('http')
        ? themeEntry
        : ApiPathUtils.themeUiAssetUrl(baseUrl, themeSlug, themeEntry);
      const versionedEntryUrl = PublicAssetUrlUtils.appendVersion(entryUrl, theme?.version);
      const registry = ((window as any).__fromcodeLoadedThemeEntries ||= new Set<string>()) as Set<string>;
      const slugRegistry = ((window as any).__fromcodeLoadedThemeEntryUrls ||= new Map<string, string>()) as Map<string, string>;
      const existingEntryUrl = slugRegistry.get(themeSlug) || '';
      if (existingEntryUrl && existingEntryUrl !== versionedEntryUrl) {
        const comparison = ContextProviderConfigLoaderHooks.compareThemeEntryUrls(existingEntryUrl, versionedEntryUrl);
        if (comparison >= 0) {
          return;
        }
      }
      if (registry.has(versionedEntryUrl)) {
        slugRegistry.set(themeSlug, versionedEntryUrl);
        return;
      }

      slugRegistry.set(themeSlug, versionedEntryUrl);

      const preloadSelector = `link[rel="modulepreload"][href="${versionedEntryUrl}"]`;
      if (!document.head.querySelector(preloadSelector)) {
        const preloadLink = document.createElement('link');
        preloadLink.rel = 'modulepreload';
        preloadLink.href = versionedEntryUrl;
        preloadLink.setAttribute('data-theme-entry-preload', versionedEntryUrl);
        preloadLink.setAttribute('data-theme-slug', themeSlug);
        document.head.appendChild(preloadLink);
      }

      await import(/* webpackIgnore: true */ versionedEntryUrl);
      registry.add(versionedEntryUrl);
    }, []);

    const loadConfig = React.useCallback(async (path?: string) => {
      const resolvedPath = (typeof path === 'string' && path.trim())
        ? path.trim()
        : ContextProviderStateService.getFrontendConfigPath();
      const isFrontendConfigPath = resolvedPath === ContextProviderStateService.getFrontendConfigPath();
      if (isFrontendConfigPath && loadedConfigPathsRef.current.has(resolvedPath)) {
        return;
      }

      const inFlightRequest = inFlightConfigLoadsRef.current.get(resolvedPath);
      if (inFlightRequest) {
        return inFlightRequest;
      }

      const request = (async () => {
        try {
          const base = getBaseURL();
          const data = await apiFetch(resolvedPath, { method: 'GET', silent: true });

          if (data.runtimeModules) {
            setServerRuntimeModules(data.runtimeModules);
          }

          if (data.plugins) {
            setPlugins(data.plugins);
            const allCollections: CollectionMetadata[] = [];
            data.plugins.forEach((plugin: any) => {
              if (plugin.admin?.collections) {
                allCollections.push(...plugin.admin.collections.map((collection: any) => ({
                  ...collection,
                  pluginSlug: plugin.slug,
                })));
              }
            });
            setCollections(allCollections);
          }

          if (data.menu) {
            setMenuItems(data.menu);
          }

          setSecondaryPanel(data.secondaryPanel || ContextProviderStateService.createEmptySecondaryPanelState());

          if (data.settings) {
            setSettings(data.settings);
          }

          if (data.cssVariables) {
            let style = document.getElementById('fc-theme-variables');
            if (!style) {
              style = document.createElement('style');
              style.id = 'fc-theme-variables';
              document.head.appendChild(style);
            }
            style.textContent = data.cssVariables;
          }

          if (data.activeTheme) {
            setActiveTheme(data.activeTheme);
            setThemeVariables(data.activeTheme.variables || {});

            const theme = data.activeTheme;
            if (theme.ui?.css) {
              const cssRegistry = ((window as any).__fromcodeLoadedThemeCss ||= new Set<string>()) as Set<string>;
              theme.ui.css.forEach((cssPath: string) => {
                const fullUrl = cssPath.startsWith('http')
                  ? cssPath
                  : ApiPathUtils.themeUiAssetUrl(base, theme.slug, cssPath);
                const versionedCssUrl = PublicAssetUrlUtils.appendVersion(fullUrl, theme?.version);
                if (!cssRegistry.has(versionedCssUrl)) {
                  cssRegistry.add(versionedCssUrl);
                  const link = document.createElement('link');
                  link.rel = 'stylesheet';
                  link.href = versionedCssUrl;
                  document.head.appendChild(link);
                }
              });
            }

            try {
              await loadThemeEntry(base, theme);
            } catch (error) {
              console.warn('[Fromcode] Failed to load theme bundle:', error);
            }
          }

          loadedConfigPathsRef.current.add(resolvedPath);
          setIsReady(true);
        } catch (error) {
          console.warn('[Fromcode] Failed to load config:', error);
          setIsReady(true);
        }
      })().finally(() => {
        inFlightConfigLoadsRef.current.delete(resolvedPath);
      });

      inFlightConfigLoadsRef.current.set(resolvedPath, request);
      return request;
    }, [
      apiFetch,
      getBaseURL,
      loadThemeEntry,
      inFlightConfigLoadsRef,
      loadedConfigPathsRef,
      setActiveTheme,
      setCollections,
      setIsReady,
      setMenuItems,
      setPlugins,
      setSecondaryPanel,
      setServerRuntimeModules,
      setSettings,
      setThemeVariables,
    ]);

    return { loadConfig };
  }

  private static compareThemeEntryUrls(leftUrl: string, rightUrl: string): number {
    const leftVersion = ContextProviderConfigLoaderHooks.parseThemeEntryVersion(leftUrl);
    const rightVersion = ContextProviderConfigLoaderHooks.parseThemeEntryVersion(rightUrl);
    const maxLength = Math.max(leftVersion.length, rightVersion.length);

    for (let index = 0; index < maxLength; index += 1) {
      const leftPart = leftVersion[index] ?? 0;
      const rightPart = rightVersion[index] ?? 0;
      if (leftPart !== rightPart) {
        return leftPart > rightPart ? 1 : -1;
      }
    }

    return leftUrl.localeCompare(rightUrl);
  }

  private static parseThemeEntryVersion(url: string): number[] {
    try {
      const parsedUrl = new URL(
        url,
        typeof window !== 'undefined' ? window.location.origin : ApplicationHostUtils.LOCALHOST_ORIGIN,
      );
      return String(parsedUrl.searchParams.get('v') || '')
        .split('.')
        .map((part) => Number(part))
        .filter((part) => Number.isFinite(part));
    } catch {
      return [];
    }
  }
}
