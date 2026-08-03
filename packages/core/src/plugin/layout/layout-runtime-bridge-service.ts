import type { ILayoutDiagnosticEntry } from '@core/layout/interfaces/layout-diagnostic-entry.interface';
import type { IPluginLayoutRegistration } from '@core/layout/interfaces/plugin-layout-registration.interface';
import type { IRegisteredPluginDefaultPageContract } from '@core/default-page-contract/interfaces/registered-plugin-default-page-contract.interface';
import type { IResolvedLayout } from '@core/layout/interfaces/resolved-layout.interface';
import type { IThemeLayoutOverrideRegistration } from '@core/layout/interfaces/theme-layout-override-registration.interface';
import { ThemeLayoutOverrideRegistryService } from '@core/theme/theme-layout-override-registry-service';
import { LayoutDiagnosticService } from '@core/plugin/layout/layout-diagnostic-service';
import { LayoutLifecycleService } from '@core/plugin/layout/layout-lifecycle-service';
import { LayoutResolutionService } from '@core/plugin/layout/layout-resolution-service';
import { PluginLayoutRegistryService } from '@core/plugin/layout/plugin-layout-registry-service';

export class LayoutRuntimeBridgeService {
  constructor(
    private readonly pluginRegistry: PluginLayoutRegistryService,
    private readonly themeRegistry: ThemeLayoutOverrideRegistryService,
    private readonly resolutionService: LayoutResolutionService,
    private readonly diagnosticService: LayoutDiagnosticService,
    private readonly lifecycleService: LayoutLifecycleService,
  ) {}

  get serviceName(): string {
    return 'LayoutRuntimeBridgeService';
  }

  registerPluginDefaults(registration: IPluginLayoutRegistration): void {
    this.pluginRegistry.register(registration);
  }

  registerThemeOverrides(registration: IThemeLayoutOverrideRegistration): void {
    this.themeRegistry.register(registration);
  }

  resolvePageTarget(targetKey: string, activeThemeSlug?: string): IResolvedLayout {
    return this.resolutionService.resolvePageTarget(targetKey, activeThemeSlug);
  }

  resolveTarget(
    targetKind: IPluginLayoutRegistration['layouts'][number]['targetKind'],
    targetKey: string,
    activeThemeSlug?: string,
  ): IResolvedLayout {
    return this.resolutionService.resolveTarget(targetKind, targetKey, activeThemeSlug);
  }

  createDefaultPageContractDiagnostics(
    contracts: IRegisteredPluginDefaultPageContract[],
    activeThemeSlug?: string,
  ): ILayoutDiagnosticEntry[] {
    return this.diagnosticService.crossCheckDefaultPageContracts(contracts, activeThemeSlug);
  }

  unregisterByPlugin(namespace: string, pluginSlug: string): void {
    this.lifecycleService.unregisterByPlugin(namespace, pluginSlug);
  }

  unregisterByTheme(themeSlug: string): void {
    this.lifecycleService.unregisterByTheme(themeSlug);
  }

  resetForRuntimeReload(): void {
    this.lifecycleService.resetForRuntimeReload();
  }
}
