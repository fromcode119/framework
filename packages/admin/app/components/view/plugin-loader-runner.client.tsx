import type { ReactNode } from 'react';
import { Platform, Reactor, prop } from '@fromcode119/reactor';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { GlobalReadinessService } from '@/lib/global-readiness-service';
import { PluginMetadataBootstrapService } from '@/app/services/plugin-metadata-bootstrap-service';
import { PluginAssetLoaderService } from '@/app/services/plugin-asset-loader-service';
import { IAdminPluginMetadata } from '@/app/interfaces/admin-plugin-metadata.interface';
import type { IPluginLoaderValues } from '@/app/interfaces/plugin-loader-values.interface';

// Prevents multiple concurrent "globals not ready" retry timers from accumulating.

/**
 * Hook-free data layer behind {@link PluginLoader}: loads plugin metadata + assets into the plugins
 * context and (in development) subscribes to the HMR event stream. Renders nothing.
 *
 * The two `useEffect`s this replaces became `componentDidMount` + guarded `componentDidUpdate`; the
 * guards compare the SAME values the effects listed as dependencies, so re-runs match React exactly.
 */
export class PluginLoaderRunner extends Reactor {
  declare props: Pick<IPluginLoaderValues, keyof IPluginLoaderValues>;
  private static crossOriginEventsWarningLogged = false;
  private static globalRetryTimerId: ReturnType<typeof setTimeout> | null = null;
  // NOT `context` — React.Component's constructor assigns `this.context`, and an `@prop` accessor is
  // getter-only, so that assignment would throw "Cannot set property context which has only a getter".
  @prop declare pluginsContext: IPluginLoaderValues['pluginsContext'];
  @prop declare user: IPluginLoaderValues['user'];
  @prop declare isAuthLoading: boolean;

  private eventSource: EventSource | null = null;
  private loadCancelled = false;
  private abortController: AbortController | null = null;

  componentDidMount(): void {
    this.syncHotReloadStream();
    this.startLoad();
  }

  componentDidUpdate(prev: this['props']): void {
    if (prev.user !== this.user || prev.pluginsContext.triggerRefresh !== this.pluginsContext.triggerRefresh) {
      this.closeHotReloadStream();
      this.syncHotReloadStream();
    }
    if (this.hasLoadDependencyChanged(prev)) {
      this.cancelLoad();
      this.startLoad();
    }
  }

  componentWillUnmount(): void {
    this.closeHotReloadStream();
    this.cancelLoad();
  }

  private hasLoadDependencyChanged(prev: IPluginLoaderValues): boolean {
    const a = prev.pluginsContext;
    const b = this.pluginsContext;
    return prev.user !== this.user
      || prev.isAuthLoading !== this.isAuthLoading
      || a.isReady !== b.isReady
      || a.loadConfig !== b.loadConfig
      || a.registerSlotComponent !== b.registerSlotComponent
      || a.registerCollection !== b.registerCollection
      || a.replaceCollections !== b.replaceCollections
      || a.registerPlugins !== b.registerPlugins
      || a.registerSettings !== b.registerSettings
      || a.refreshVersion !== b.refreshVersion;
  }

  private syncHotReloadStream(): void {
    if (!Platform.isBrowser || !this.user || process.env.NODE_ENV !== 'development') return;

    const eventsUrl = new URL(AdminConstants.ENDPOINTS.SYSTEM.EVENTS, AdminConstants.API_BASE_URL || window.location.origin);
    const eventSourceUrl = eventsUrl.origin === window.location.origin
      ? eventsUrl.pathname + eventsUrl.search
      : eventsUrl.toString();

    if (eventsUrl.origin !== window.location.origin && !PluginLoaderRunner.crossOriginEventsWarningLogged) {
      PluginLoaderRunner.crossOriginEventsWarningLogged = true;
      console.info(`[HMR] Using cross-origin EventSource bridge in development from ${window.location.origin} to ${eventsUrl.origin}.`);
    }

    const eventSource = new EventSource(eventSourceUrl, { withCredentials: true });
    this.eventSource = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'plugin:ui:reload') {
          console.log(`[HMR] Changes detected in ${data.slug}. Triggering UI refresh...`);
          // triggerRefresh clears existing slots/menu items and increments refreshVersion,
          // which makes the load run again.
          this.pluginsContext.triggerRefresh();
        }
      } catch (err) {
        console.error('[HMR] Failed to parse event data:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('[HMR] EventSource connection lost. Closing dev stream until the next page refresh.');
      eventSource.close();
    };
  }

  private closeHotReloadStream(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  private cancelLoad(): void {
    this.loadCancelled = true;
    this.abortController?.abort();
    this.abortController = null;
    if (PluginLoaderRunner.globalRetryTimerId) {
      clearTimeout(PluginLoaderRunner.globalRetryTimerId);
      PluginLoaderRunner.globalRetryTimerId = null;
    }
  }

  private startLoad(): void {
    if (!Platform.isBrowser || this.isAuthLoading || !this.user) return;
    this.loadCancelled = false;
    this.abortController = new AbortController();
    void this.loadPlugins(this.abortController);
  }

  private async loadPlugins(abortController: AbortController): Promise<void> {
    const ctx = this.pluginsContext;
    if (!ctx.isReady) {
      await PluginMetadataBootstrapService.ensureLoaded(ctx.loadConfig);
      return;
    }

    try {
      await GlobalReadinessService.waitForReady(abortController.signal);
    } catch (err) {
      if (abortController.signal.aborted) return;
      console.error('[Admin] Required globals not ready. Scheduling retry.', err);
      if (!PluginLoaderRunner.globalRetryTimerId) {
        PluginLoaderRunner.globalRetryTimerId = setTimeout(() => {
          PluginLoaderRunner.globalRetryTimerId = null;
          if (!this.loadCancelled) ctx.triggerRefresh();
        }, 3000);
      }
      return;
    }

    if (this.loadCancelled) return;

    try {
      const shouldReuseContextMetadata = ctx.refreshVersion === 0 && Array.isArray(ctx.plugins) && ctx.plugins.length > 0;
      if (!shouldReuseContextMetadata) {
        await PluginMetadataBootstrapService.ensureLoaded(ctx.loadConfig);
      }
      const responseData = shouldReuseContextMetadata
        ? { plugins: ctx.plugins, settings: ctx.settings }
        : await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.STAGED);
      const plugins: IAdminPluginMetadata[] = responseData.plugins || [];
      const settings: Record<string, any> = responseData.settings || {};

      if (settings) {
        ctx.registerSettings(settings);
      }

      if (Array.isArray(plugins)) {
        ctx.registerPlugins(plugins);
        PluginAssetLoaderService.apply({
          plugins,
          refreshVersion: ctx.refreshVersion,
          callbacks: {
            registerSlotComponent: ctx.registerSlotComponent,
            registerCollection: ctx.registerCollection,
            replaceCollections: ctx.replaceCollections,
          },
        });
      }
    } catch (err) {
      console.error('Failed to load plugin metadata:', err);
    }
  }

  render(): ReactNode {
    return null;
  }
}
