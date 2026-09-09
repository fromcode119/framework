import { MarketplaceCatalogService } from '@core/marketplace/marketplace-catalog-service';
import { CoreExtensionManager } from '@core/extensions/extension-manager';
import { RuntimeService } from '@core/plugin/services/runtime/runtime-service';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';
import { AdminMetadataService } from '@core/plugin/services/admin/admin-metadata-service';
import { LifecycleService } from '@core/plugin/services/runtime/lifecycle-service';
import { PluginTelemetryService } from '@core/plugin/services/health/plugin-telemetry-service';
import { PluginScaffoldService } from '@core/plugin/services/installation/plugin-scaffold-service';
import { PluginAdminRuntimeService } from '@core/plugin/services/admin/plugin-admin-runtime-service';
import { PluginInstallationService } from '@core/plugin/services/installation/plugin-installation-service';
import { PluginRuntimeStateService } from '@core/plugin/services/runtime/plugin-runtime-state-service';
import { PluginManagerInitService } from '@core/plugin/services/runtime/plugin-manager-init-service';
import { PluginDiscoveryCoordinatorService } from '@core/plugin/services/installation/plugin-discovery-coordinator-service';
import { PluginManagerShutdownService } from '@core/plugin/services/runtime/plugin-manager-shutdown-service';
import { PluginExtensionArchiveInstaller } from '@core/plugin/services/installation/plugin-extension-archive-installer';

export interface IPluginManagerServiceBundle {
  runtime: RuntimeService;
  registry: PluginStateService;
  discovery: DiscoveryService;
  marketplace: MarketplaceCatalogService;
  admin: AdminMetadataService;
  lifecycle: LifecycleService;
  adminRuntime: PluginAdminRuntimeService;
  runtimeState: PluginRuntimeStateService;
  installation: PluginInstallationService;
  telemetry: PluginTelemetryService;
  scaffold: PluginScaffoldService;
  extensions: CoreExtensionManager;
  bootstrap: PluginManagerInitService;
  discoveryCoordinator: PluginDiscoveryCoordinatorService;
  shutdownService: PluginManagerShutdownService;
  archiveInstaller: PluginExtensionArchiveInstaller;
}
