import { ThemeLayoutOverrideRegistryService } from '../../theme/theme-layout-override-registry-service';
import { PluginLayoutRegistryService } from './plugin-layout-registry-service';

export class LayoutLifecycleService {
  constructor(
    private readonly pluginRegistry: PluginLayoutRegistryService,
    private readonly themeRegistry: ThemeLayoutOverrideRegistryService,
  ) {}

  get serviceName(): string {
    return 'LayoutLifecycleService';
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