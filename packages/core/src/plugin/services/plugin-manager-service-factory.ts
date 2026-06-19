import { ProjectPaths } from '../../config/paths';
import { MarketplaceCatalogService } from '../../marketplace/marketplace-catalog-service';
import { CoreExtensionManager } from '../../extensions/extension-manager';
import { MigrationManager } from '../../database/migration-manager';
import { MigrationCoordinator } from '../../management/migration-coordinator';
import { RuntimeService } from './runtime-service';
import { PluginStateService } from './plugin-state-service';
import { DiscoveryService } from './discovery-service';
import { AdminMetadataService } from './admin-metadata-service';
import { LifecycleService } from './lifecycle-service';
import { WorkflowService } from './workflow-service';
import { PluginTelemetryService } from './plugin-telemetry-service';
import { PluginScaffoldService } from './plugin-scaffold-service';
import { PluginAdminRuntimeService } from './plugin-admin-runtime-service';
import { PluginInstallationService } from './plugin-installation-service';
import { PluginRuntimeStateService } from './plugin-runtime-state-service';
import { PluginRuntimeRestartService } from './plugin-runtime-restart-service';
import { PluginManagerInitService } from './plugin-manager-init-service';
import { PluginDiscoveryCoordinatorService } from './plugin-discovery-coordinator-service';
import { PluginManagerShutdownService } from './plugin-manager-shutdown-service';
import { PluginExtensionArchiveInstaller } from './plugin-extension-archive-installer';
import type { PluginManagerServiceBundle } from './plugin-manager-service-factory.interfaces';

/**
 * PluginManagerServiceFactory
 *
 * Builds the graph of refactored PluginManager collaborator services. Extracted
 * from PluginManager's constructor to keep that class under the size limit; the
 * manager calls build(this) (after its primitive fields are set) and assigns the
 * returned bundle to its fields. Wiring and ordering are identical to before.
 */
export class PluginManagerServiceFactory {
  static build(
    manager: any,
    deps: {
      migrationManager: MigrationManager;
      coordinator: MigrationCoordinator;
      workflow: WorkflowService;
    },
  ): PluginManagerServiceBundle {
    const runtime = new RuntimeService(manager.projectRoot);
    const registry = new PluginStateService(manager.db);
    const discovery = new DiscoveryService(manager.pluginsRoot, manager.projectRoot);
    const marketplace = new MarketplaceCatalogService(discovery);
    const admin = new AdminMetadataService();
    const lifecycle = new LifecycleService(manager, registry, discovery, manager.schemaManager);
    const adminRuntime = new PluginAdminRuntimeService(
      manager.logger,
      manager.db,
      admin,
      lifecycle,
      runtime,
      manager.security,
      manager.plugins,
      manager.registeredCollections,
    );
    const runtimeState = new PluginRuntimeStateService(
      manager.logger,
      manager.db,
      registry,
      manager.plugins,
      manager.headInjections,
      manager.registeredCollections,
      manager.pluginSettings,
    );
    const installation = new PluginInstallationService(
      manager.logger,
      marketplace,
      discovery,
      deps.migrationManager,
      registry,
      new PluginRuntimeRestartService(manager.logger),
      manager.plugins,
      manager.pluginsRoot,
      () => manager.discoverPlugins(),
      (slug: string) => manager.enable(slug),
    );

    // Telemetry & scaffold services (email getter deferred so integrations are ready)
    const telemetry = new PluginTelemetryService(manager.db, () => manager.email);
    const scaffold = new PluginScaffoldService(
      manager.logger,
      (slug: string) => manager.plugins.has(slug),
      () => manager.discoverPlugins(),
      (slug: string) => manager.enable(slug),
    );

    // Initialize Core Extension System
    const packagesRoot = ProjectPaths.getPackagesDir();
    const extensions = new CoreExtensionManager(manager.db, packagesRoot, manager.logger);

    const bootstrap = new PluginManagerInitService(
      manager,
      manager.logger,
      manager.db,
      deps.migrationManager,
      deps.coordinator,
      deps.workflow,
    );
    const discoveryCoordinator = new PluginDiscoveryCoordinatorService(
      manager.logger,
      manager.plugins,
      registry,
      discovery,
      deps.coordinator,
      lifecycle,
    );
    const shutdownService = new PluginManagerShutdownService(manager, manager.logger);
    const archiveInstaller = new PluginExtensionArchiveInstaller(
      (filePath: string, options: { enable?: boolean }) => manager.installUploadedPluginArchive(filePath, options),
    );

    return {
      runtime,
      registry,
      discovery,
      marketplace,
      admin,
      lifecycle,
      adminRuntime,
      runtimeState,
      installation,
      telemetry,
      scaffold,
      extensions,
      bootstrap,
      discoveryCoordinator,
      shutdownService,
      archiveInstaller,
    };
  }
}
