import type {
  LayoutDiagnosticEntry,
  PluginLayoutRegistration,
  RegisteredPluginDefaultPageContract,
  ResolvedLayout,
  ThemeLayoutOverrideRegistration,
} from '../../types';
import { ThemeLayoutOverrideRegistryService } from '../../theme/theme-layout-override-registry-service';
import { LayoutDiagnosticService } from './layout-diagnostic-service';
import { LayoutLifecycleService } from './layout-lifecycle-service';
import { LayoutResolutionService } from './layout-resolution-service';
import { PluginLayoutRegistryService } from './plugin-layout-registry-service';

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

  registerPluginDefaults(registration: PluginLayoutRegistration): void {
    this.pluginRegistry.register(registration);
  }

  registerThemeOverrides(registration: ThemeLayoutOverrideRegistration): void {
    this.themeRegistry.register(registration);
  }

  resolvePageTarget(targetKey: string, activeThemeSlug?: string): ResolvedLayout {
    return this.resolutionService.resolvePageTarget(targetKey, activeThemeSlug);
  }

  resolveTarget(
    targetKind: PluginLayoutRegistration['layouts'][number]['targetKind'],
    targetKey: string,
    activeThemeSlug?: string,
  ): ResolvedLayout {
    return this.resolutionService.resolveTarget(targetKind, targetKey, activeThemeSlug);
  }

  createDefaultPageContractDiagnostics(
    contracts: RegisteredPluginDefaultPageContract[],
    activeThemeSlug?: string,
  ): LayoutDiagnosticEntry[] {
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
