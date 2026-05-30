import type {
  DefaultDesignDiagnosticEntry,
  PluginDefaultDesignRegistration,
  RegisteredPluginDefaultPageContract,
  ResolvedDefaultDesign,
  ThemeDesignOverrideRegistration,
} from '../../types';
import { ThemeDesignOverrideRegistryService } from '../../theme/theme-design-override-registry-service';
import { DefaultDesignDiagnosticService } from './default-design-diagnostic-service';
import { DefaultDesignLifecycleService } from './default-design-lifecycle-service';
import { DefaultDesignResolutionService } from './default-design-resolution-service';
import { PluginDefaultDesignRegistryService } from './plugin-default-design-registry-service';

export class DefaultDesignRuntimeBridgeService {
  constructor(
    private readonly pluginRegistry: PluginDefaultDesignRegistryService,
    private readonly themeRegistry: ThemeDesignOverrideRegistryService,
    private readonly resolutionService: DefaultDesignResolutionService,
    private readonly diagnosticService: DefaultDesignDiagnosticService,
    private readonly lifecycleService: DefaultDesignLifecycleService,
  ) {}

  get serviceName(): string {
    return 'DefaultDesignRuntimeBridgeService';
  }

  registerPluginDefaults(registration: PluginDefaultDesignRegistration): void {
    this.pluginRegistry.register(registration);
  }

  registerThemeOverrides(registration: ThemeDesignOverrideRegistration): void {
    this.themeRegistry.register(registration);
  }

  resolvePageTarget(targetKey: string, activeThemeSlug?: string): ResolvedDefaultDesign {
    return this.resolutionService.resolvePageTarget(targetKey, activeThemeSlug);
  }

  resolveTarget(
    targetKind: PluginDefaultDesignRegistration['designs'][number]['targetKind'],
    targetKey: string,
    activeThemeSlug?: string,
  ): ResolvedDefaultDesign {
    return this.resolutionService.resolveTarget(targetKind, targetKey, activeThemeSlug);
  }

  createDefaultPageContractDiagnostics(
    contracts: RegisteredPluginDefaultPageContract[],
    activeThemeSlug?: string,
  ): DefaultDesignDiagnosticEntry[] {
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
