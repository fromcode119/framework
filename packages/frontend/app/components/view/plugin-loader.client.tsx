import { Reactor, bound, state } from '@fromcode119/reactor';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import type { IPluginContextValue } from '@fromcode119/react';
import { EnvUtils } from '@fromcode119/core/client';
import { FrontendApiBaseUrl } from '@/lib/api-base-url';
import { PluginLoaderMountService } from '@/app/plugin-loader-mount-service';
import { PluginLoaderThemeTracker } from '@/app/plugin-loader-theme-tracker';
import { FrontendRuntimeScheduler } from '@/app/frontend-runtime-scheduler';

export class PluginLoader extends Reactor {
  static contextType = PluginContextRegistry.Context;
  declare context: IPluginContextValue | null;

  @state retryTick = 0;

  private readonly loadedModules = new Set<string>();
  private readonly previousPluginOwnersRef = { current: [] as Array<{ namespace: string; pluginSlug: string }> };
  private readonly previousThemeSlugRef = { current: '' };
  private cleanupImportMapWait?: () => void;

  private lastReconcile?: { pluginList: any[]; themeSlug?: string };
  private lastMount?: { pluginList: any[]; apiUrl: string; isReady: boolean; retryTick: number; theme: any };

  private get api(): any {
    return this.context?.api;
  }

  private get apiUrl(): string {
    return (
      (typeof this.api?.getBaseUrl === 'function' && this.api.getBaseUrl()) ||
      FrontendApiBaseUrl.resolveFrontendApiBaseUrl()
    );
  }

  private get theme(): any {
    return this.context?.activeTheme;
  }

  private get isReady(): boolean {
    return !!this.context?.isReady;
  }

  private get pluginList(): any[] {
    const plugins = this.context?.plugins;
    return Array.isArray(plugins) ? plugins : [];
  }

  componentDidMount(): void {
    this.runThemeReconcile();
    this.runMount();
  }

  componentDidUpdate(): void {
    const pluginList = this.pluginList;
    const themeSlug = this.theme?.slug;
    if (!this.lastReconcile || this.lastReconcile.pluginList !== pluginList || this.lastReconcile.themeSlug !== themeSlug) {
      this.runThemeReconcile();
    }

    const apiUrl = this.apiUrl;
    const isReady = this.isReady;
    const retryTick = this.retryTick;
    const theme = this.theme;
    const m = this.lastMount;
    if (
      !m ||
      m.pluginList !== pluginList ||
      m.apiUrl !== apiUrl ||
      m.isReady !== isReady ||
      m.retryTick !== retryTick ||
      m.theme !== theme
    ) {
      this.runMount();
    }
  }

  componentWillUnmount(): void {
    if (this.cleanupImportMapWait) {
      this.cleanupImportMapWait();
      this.cleanupImportMapWait = undefined;
    }
  }

  private runThemeReconcile(): void {
    const pluginList = this.pluginList;
    const themeSlug = this.theme?.slug;
    this.lastReconcile = { pluginList, themeSlug };
    PluginLoaderThemeTracker.reconcile({
      pluginList,
      themeSlug,
      previousThemeSlugRef: this.previousThemeSlugRef,
      previousPluginOwnersRef: this.previousPluginOwnersRef,
    });
  }

  @bound
  private async loadModule(moduleKey: string, moduleUrl: string): Promise<void> {
    if (!moduleUrl || this.loadedModules.has(moduleKey)) return;
    try {
      await import(/* webpackIgnore: true */ moduleUrl);
      this.loadedModules.add(moduleKey);
    } catch (err) {
      console.error(`[frontend] Failed to import runtime module ${moduleKey}:`, err);
    }
  }

  private runMount(): void {
    // Tear down any pending import-map wait from a previous run before re-running.
    if (this.cleanupImportMapWait) {
      this.cleanupImportMapWait();
      this.cleanupImportMapWait = undefined;
    }

    const pluginList = this.pluginList;
    const apiUrl = this.apiUrl;
    const isReady = this.isReady;
    const theme = this.theme;
    this.lastMount = { pluginList, apiUrl, isReady, retryTick: this.retryTick, theme };

    if (!EnvUtils.isBrowser()) return;
    if (!isReady) return;

    PluginLoaderMountService.mountThemeCss(theme, apiUrl);

    if (!PluginLoaderMountService.isImportMapReady()) {
      // Primary trigger: event dispatched by ImportMapInstaller when import map is written.
      const handler = () => { this.retryTick = this.retryTick + 1; };
      window.addEventListener('fromcode:import-map-ready', handler, { once: true });
      // Fallback poll every 50ms in case the event was already fired before this effect ran.
      const timer = window.setTimeout(() => { this.retryTick = this.retryTick + 1; }, 50);
      this.cleanupImportMapWait = () => {
        window.clearTimeout(timer);
        window.removeEventListener('fromcode:import-map-ready', handler);
      };
      return;
    }

    PluginLoaderMountService.mountHeadInjections(pluginList, apiUrl);
    PluginLoaderMountService.mountPluginCss(pluginList, apiUrl);
    // The runtime bundles come AFTER the paint. The server already rendered the layout and the block
    // flow, so nothing on screen is waiting for them — fetching ~790 KB of plugin JavaScript alongside
    // the LCP image only delays that image. See FrontendRuntimeScheduler.
    FrontendRuntimeScheduler.run(() => {
      PluginLoaderMountService.loadThemeRuntime(theme, apiUrl, this.loadModule);
      PluginLoaderMountService.loadPluginRuntimes(pluginList, apiUrl, this.loadModule);
    });
  }

  render(): null {
    return null;
  }
}
