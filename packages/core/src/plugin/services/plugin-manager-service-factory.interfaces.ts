import { MarketplaceCatalogService } from '../../marketplace/marketplace-catalog-service';
import { CoreExtensionManager } from '../../extensions/extension-manager';
import { RuntimeService } from './runtime-service';
import { PluginStateService } from './plugin-state-service';
import { DiscoveryService } from './discovery-service';
import { AdminMetadataService } from './admin-metadata-service';
import { LifecycleService } from './lifecycle-service';
import { PluginTelemetryService } from './plugin-telemetry-service';
import { PluginScaffoldService } from './plugin-scaffold-service';
import { PluginAdminRuntimeService } from './plugin-admin-runtime-service';
import { PluginInstallationService } from './plugin-installation-service';
import { PluginRuntimeStateService } from './plugin-runtime-state-service';
import { PluginManagerInitService } from './plugin-manager-init-service';
import { PluginDiscoveryCoordinatorService } from './plugin-discovery-coordinator-service';
import { PluginManagerShutdownService } from './plugin-manager-shutdown-service';
import { PluginExtensionArchiveInstaller } from './plugin-extension-archive-installer';

export interface PluginManagerServiceBundle {
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
