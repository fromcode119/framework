import { ApiPathUtils } from '@fromcode119/core/client';
import { FrontendAssetVersionUrlService } from '@/lib/frontend-asset-version-url-service';

export class PluginLoaderMountService {

  static isImportMapReady(): boolean {
    // Plugin/theme ESM bundles import bare specifiers (e.g. @fromcode119/react).
    // Wait until BOTH the runtime import map script tag exists AND the react bridge
    // registry entry is populated. The script tag is created synchronously inside
    // installRuntimeBridge(), but we double-check the registry to guard against any
    // edge-case where the tag was created before the bridge object was written.
    const importMapScript = document.getElementById('fc-runtime-import-map') as HTMLScriptElement | null;
    const importMapText = String(importMapScript?.textContent || '');
    return (
      !!importMapScript &&
      importMapText.includes('"react"') &&
      importMapText.includes('useInsertionEffect') &&
      importMapText.includes('useSyncExternalStore') &&
      importMapText.includes('@fromcode119/sdk/react') &&
      !!(window as any).__fromcodeRuntimeModules?.['@fromcode119/react'] &&
      !!(window as any).__fromcodeRuntimeModules?.['@fromcode119/sdk/react']
    );
  }
  static mountThemeCss(theme: any, apiUrl: string): void {
    if (!theme?.slug) return;
    const themeCss = Array.isArray(theme?.ui?.css) ? theme.ui.css : [];
    themeCss.forEach((style: string) => {
      const href = style.startsWith('http') ? style : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, style);
      const versionedHref = FrontendAssetVersionUrlService.appendVersion(href, theme.version);
      if (document.head.querySelector(`link[href="${versionedHref}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = versionedHref;
      document.head.appendChild(link);
    });
  }

  static mountHeadInjections(pluginList: any[], apiUrl: string): void {
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
        const target = String(injection?.target || '').trim() === 'bodyStart' ? document.body : document.head;

        if (uniqueKey) {
          const selector = `${tag}[id="${uniqueKey}"], ${tag}[src="${uniqueKey}"], ${tag}[href="${uniqueKey}"], ${tag}[name="${uniqueKey}"]`;
          if (target.querySelector(selector)) continue;
        }

        const element = document.createElement(tag);
        Object.entries(props).forEach(([key, rawValue]) => {
          let value = String(rawValue);
          if ((key === 'src' || key === 'href') && value.startsWith('/plugins/')) {
            value = `${apiUrl}${value}`;
          }
          if (rawValue === '' || rawValue === true) {
            element.setAttribute(key, '');
            return;
          }
          element.setAttribute(key, value);
        });
        if (typeof injection?.content === 'string' && injection.content.trim()) {
          element.innerHTML = injection.content;
        }
        if (target === document.body && document.body.firstChild) {
          document.body.insertBefore(element, document.body.firstChild);
        } else {
          target.appendChild(element);
        }
      }
    }
  }

  static loadThemeRuntime(theme: any, apiUrl: string, loadModule: (key: string, url: string) => Promise<void>): void {
    if (!theme?.slug) return;
    const themeEntry = String(theme?.ui?.entry || '').trim();
    if (!themeEntry) return;
    const themeEntryUrl = themeEntry.startsWith('http')
      ? themeEntry
      : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, themeEntry);
    const versionedThemeEntryUrl = FrontendAssetVersionUrlService.appendVersion(themeEntryUrl, theme.version);
    const themeModuleKey = `theme:${theme.slug}:${themeEntry}`;
    void loadModule(themeModuleKey, versionedThemeEntryUrl);
  }

  // Load plugin runtime modules after import map is registered.
  // Only load plugins with the 'frontend' capability — admin-only plugins have no
  // frontend-visible slots and should not bloat the public page JS payload.
  // Plugins with loadStrategy "idle" are deferred until the browser is idle.
  // Plugins with loadStrategy "none" are skipped entirely on the frontend.
  static loadPluginRuntimes(pluginList: any[], apiUrl: string, loadModule: (key: string, url: string) => Promise<void>): void {
    pluginList.forEach((plugin: any) => {
      // Frontend-only plugins ship only a `frontendEntry` (no admin `entry`); still load them.
      if (!plugin?.ui?.entry && !plugin?.ui?.frontendEntry) return;
      const caps: string[] = Array.isArray(plugin.capabilities) ? plugin.capabilities : [];
      if (caps.length > 0 && !caps.includes('frontend')) return;

      const entryFile = String(plugin.ui.frontendEntry || plugin.ui.entry).trim();
      const moduleUrl = FrontendAssetVersionUrlService.appendVersion(
        ApiPathUtils.pluginUiAssetUrl(apiUrl, plugin.slug, entryFile),
        plugin.version || plugin.manifest?.version,
      );
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
  }

  // Ensure plugin-provided CSS is mounted (idempotent).
  static mountPluginCss(pluginList: any[], apiUrl: string): void {
    pluginList.forEach((plugin: any) => {
      const css = plugin?.ui?.css;
      if (!css) return;
      const cssList = Array.isArray(css) ? css : [css];
      cssList.forEach((style: string) => {
        const href = ApiPathUtils.pluginUiAssetUrl(apiUrl, plugin.slug, style);
        const versionedHref = FrontendAssetVersionUrlService.appendVersion(href, plugin.version || plugin.manifest?.version);
        if (document.head.querySelector(`link[href="${versionedHref}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = versionedHref;
        document.head.appendChild(link);
      });
    });
  }
}
