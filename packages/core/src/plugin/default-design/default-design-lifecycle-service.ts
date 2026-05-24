import { ThemeDesignOverrideRegistryService } from '../../theme/theme-design-override-registry-service';
import { PluginDefaultDesignRegistryService } from './plugin-default-design-registry-service';

export class DefaultDesignLifecycleService {
  constructor(
    private readonly pluginRegistry: PluginDefaultDesignRegistryService,
    private readonly themeRegistry: ThemeDesignOverrideRegistryService,
  ) {}

  get serviceName(): string {
    return 'DefaultDesignLifecycleService';
  }

  unregisterByPlugin(namespace: string, pluginSlug: string): void {
    this.pluginRegistry.unregisterByPlugin(namespace, pluginSlug);
  }

  unregisterByTheme(themeSlug: string): void {
    this.themeRegistry.unregisterByTheme(themeSlug);
  }

  resetForRuntimeReload(): void {
    this.pluginRegistry.clear();
    this.themeRegistry.clear();
  }
}