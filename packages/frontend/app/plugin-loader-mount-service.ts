import { ApiPathUtils, PluginFrontendRuntimeUtils, PublicAssetUrlUtils } from '@fromcode119/core/client';
import { FrontendAssetVersionUrlService } from '@/lib/frontend-asset-version-url-service';
import { RuntimeModuleRef } from '@/app/runtime-module-ref';

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
  /**
   * Mounts the theme's `ui.css` as `<link rel=stylesheet>` — but ONLY when the server
   * did not already inline it.
   *
   * `theme-assets.tsx` fetches `ui.css` server-side and emits it as
   * `<style data-theme="<slug>">` to kill the render-blocking external stylesheet. The
   * old dedupe guard below only looked for a matching `link[href]`, which a `<style>`
   * tag never satisfies — so every inlined stylesheet was ALSO downloaded again here,
   * cross-origin from the api. That is not merely a redundant css fetch: `ui.css` may
   * declare `@font-face` with ROOT-RELATIVE `src` urls, which resolve against the
   * document origin when inlined but against the API origin when loaded via this
   * `<link>` — two different urls for the same file, so the browser cache can never
   * dedupe them and EVERY font downloads twice (measured: 18 font requests / 491 KiB
   * for 9 faces on the storefront). Bail out when the inline `<style>` is present.
   */
  static mountThemeCss(theme: any, apiUrl: string): void {
    if (!theme?.slug) return;
    if (document.head.querySelector(`style[data-theme="${CSS.escape(String(theme.slug))}"]`)) return;
    const themeCss = Array.isArray(theme?.ui?.css) ? theme.ui.css : [];
    themeCss.forEach((style: string) => {
      const href = style.startsWith('http') ? style : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, style);
      const versionedHref = FrontendAssetVersionUrlService.appendVersion(href, PublicAssetUrlUtils.themeAssetStamp(theme));
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

  /** The theme's runtime bundle, or null when the theme ships none. */
  static themeRuntimeModule(theme: any, apiUrl: string): RuntimeModuleRef | null {
    if (!theme?.slug) return null;
    const themeEntry = String(theme?.ui?.entry || '').trim();
    if (!themeEntry) return null;
    const themeEntryUrl = themeEntry.startsWith('http')
      ? themeEntry
      : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, themeEntry);
    const versionedThemeEntryUrl = FrontendAssetVersionUrlService.appendVersion(themeEntryUrl, PublicAssetUrlUtils.themeAssetStamp(theme));
    return new RuntimeModuleRef(`theme:${theme.slug}:${themeEntry}`, versionedThemeEntryUrl);
  }

  static loadThemeRuntime(theme: any, apiUrl: string, loadModule: (key: string, url: string) => Promise<void>): void {
    const ref = PluginLoaderMountService.themeRuntimeModule(theme, apiUrl);
    if (ref) void loadModule(ref.key, ref.url);
  }

  /**
   * The plugin runtime bundles this storefront loads, in manifest order.
   * Only plugins with the 'frontend' capability — admin-only plugins have no frontend-visible slots and
   * should not bloat the public page JS payload. `loadStrategy: 'idle'` is carried on the ref;
   * `loadStrategy: 'none'` is excluded entirely.
   */
  static pluginRuntimeModules(pluginList: any[], apiUrl: string): RuntimeModuleRef[] {
    const refs: RuntimeModuleRef[] = [];
    pluginList.forEach((plugin: any) => {
      // Frontend-only plugins ship only a `frontendEntry` (no admin `entry`); still load them.
      // Shared with the plugin API registry, which leaves these plugins' keys empty until the module
      // below registers their real client — the two decisions MUST agree, so both ask the same class.
      if (!PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime(plugin)) return;

      const entryFile = String(plugin.ui.frontendEntry || plugin.ui.entry).trim();
      const moduleUrl = FrontendAssetVersionUrlService.appendVersion(
        ApiPathUtils.pluginUiAssetUrl(apiUrl, plugin.slug, entryFile),
        plugin.version || plugin.manifest?.version,
      );
      // `none` is already excluded by loadsOwnFrontendRuntime above.
      const strategy = String(plugin?.ui?.loadStrategy || 'eager').trim();
      refs.push(new RuntimeModuleRef(`plugin:${plugin.slug}:${entryFile}`, moduleUrl, strategy === 'idle', String(plugin.slug || '')));
    });
    return refs;
  }

  // Load plugin runtime modules after import map is registered. Idle-strategy plugins are deferred
  // until the browser is idle.
  static loadPluginRuntimes(pluginList: any[], apiUrl: string, loadModule: (key: string, url: string) => Promise<void>, skip: Set<string> = new Set()): void {
    for (const ref of PluginLoaderMountService.pluginRuntimeModules(pluginList, apiUrl)) {
      // The islands document names the idle plugins this page never renders — see PluginBundlePolicy.
      if (ref.idle && skip.has(ref.pluginSlug)) continue;
      if (!ref.idle) {
        void loadModule(ref.key, ref.url);
      } else if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => void loadModule(ref.key, ref.url), { timeout: 5000 });
      } else {
        setTimeout(() => void loadModule(ref.key, ref.url), 2000);
      }
    }
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
