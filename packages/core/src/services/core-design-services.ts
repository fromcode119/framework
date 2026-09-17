import { LayoutDiagnosticService } from '@core/plugin/layout/layout-diagnostic-service';
import { LayoutLifecycleService } from '@core/plugin/layout/layout-lifecycle-service';
import { LayoutResolutionService } from '@core/plugin/layout/layout-resolution-service';
import { LayoutRuntimeBridgeService } from '@core/plugin/layout/layout-runtime-bridge-service';
import { PluginLayoutRegistryService } from '@core/plugin/layout/plugin-layout-registry-service';
import { ThemeLayoutOverrideRegistryService } from '@core/theme/theme-layout-override-registry-service';

/**
 * The default-page DESIGN graph: what a plugin declares, what a theme overrides, and the runtime
 * bridge the frontend actually asks.
 *
 * These six services only ever exist together — each one is constructed from the ones above it — so
 * they are built here rather than as six independent lazy fields on the container. Only the runtime
 * bridge is reachable from outside; the rest are its collaborators, and a caller that reached past it
 * would be resolving a layout without the diagnostics and overrides that make the answer correct.
 *
 * Lazy throughout, because a deployment that renders no plugin default page builds none of it.
 */
export class CoreDesignServices {
  private _registry: PluginLayoutRegistryService | null = null;
  private _themeOverrides: ThemeLayoutOverrideRegistryService | null = null;
  private _resolution: LayoutResolutionService | null = null;
  private _diagnostic: LayoutDiagnosticService | null = null;
  private _lifecycle: LayoutLifecycleService | null = null;
  private _runtimeBridge: LayoutRuntimeBridgeService | null = null;

  /** What each plugin declared as its default page design. */
  private get registry(): PluginLayoutRegistryService {
    return (this._registry ??= new PluginLayoutRegistryService());
  }

  /** What the active theme replaces in those declarations. */
  private get themeOverrides(): ThemeLayoutOverrideRegistryService {
    return (this._themeOverrides ??= new ThemeLayoutOverrideRegistryService());
  }

  /** Which design wins for a given page, given both of the above. */
  private get resolution(): LayoutResolutionService {
    return (this._resolution ??= new LayoutResolutionService(this.registry, this.themeOverrides));
  }

  /** Why it won — the answer the admin's diagnostics screen shows. */
  private get diagnostic(): LayoutDiagnosticService {
    return (this._diagnostic ??= new LayoutDiagnosticService(this.registry, this.resolution));
  }

  /** Registering and retiring designs as plugins and themes come and go. */
  private get lifecycle(): LayoutLifecycleService {
    return (this._lifecycle ??= new LayoutLifecycleService(this.registry, this.themeOverrides));
  }

  /** The one surface the rest of the platform uses. */
  get runtimeBridge(): LayoutRuntimeBridgeService {
    return (this._runtimeBridge ??= new LayoutRuntimeBridgeService(
      this.registry,
      this.themeOverrides,
      this.resolution,
      this.diagnostic,
      this.lifecycle,
    ));
  }
}
