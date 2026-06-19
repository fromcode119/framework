import { Logger } from '../../logging';
import { IDatabaseManager } from '@fromcode119/database';
import { MigrationManager } from '../../database/migration-manager';
import { MigrationCoordinator } from '../../management/migration-coordinator';
import { WorkflowService } from './workflow-service';
import { PersonCatalogService } from './person-catalog-service';
import { RecordVersions } from '../../collections/record-versions';
import { WebhooksCollection } from '../../collections/webhooks';

/**
 * PluginManagerInitService
 *
 * Boot sequence for PluginManager.init(): run migrations, seed person catalogs,
 * validate DB state, initialize integrations and core extensions, register the
 * background workers / scheduled tasks and system collections, and start the
 * background services. Extracted from PluginManager to keep that class under the
 * size limit; PluginManager keeps its public init() entry point and delegates,
 * passing itself in so the service drives the same instances as before.
 */
export class PluginManagerInitService {
  constructor(
    private manager: any,
    private logger: Logger,
    private db: IDatabaseManager,
    private migrationManager: MigrationManager,
    private coordinator: MigrationCoordinator,
    private workflow: WorkflowService,
  ) {}

  async init(): Promise<void> {
    const manager = this.manager;

    await this.migrationManager.migrate();
    try {
      await new PersonCatalogService(this.db as any).seedDefaults();
    } catch (error) {
      this.logger.warn(`[people] Failed to seed default person catalogs: ${error instanceof Error ? error.message : String(error)}`);
    }
    await this.coordinator.validateDatabaseState();
    await manager.integrations.initialize();

    // Discover and initialize core extensions BEFORE plugin initialization
    // This ensures extensions like AI can register integration types before plugins need them
    manager.extensions.setServices({
      integrations: manager.integrations,
      hooks: manager.hooks,
      plugins: manager,
    });

    try {
      await manager.extensions.discover();
      await manager.extensions.initializeAll();
      this.logger.info('Core extensions initialized');
    } catch (error) {
      this.logger.error('Failed to initialize core extensions:', error);
      // Don't fail startup if extensions fail - they're optional
    }

    // Register background workers - MUST happen after migrations but before scheduler starts
    manager.jobs.registerWorker('scheduler', async (job: any) => {
      const { taskName } = job.data;
      await manager.scheduler.runHandler(taskName);
    });

    // Register global content workflow task - MUST happen after migrations
    await manager.scheduler.register('content-workflows', '2m', async () => {
      await this.workflow.processScheduledContent(manager.getCollections());
    });
    await manager.scheduler.register('system-email-telemetry-weekly', '0 9 * * 1', async () => {
      await manager.sendWeeklyEmailTelemetryDigest();
    }, { type: 'cron' });

    // Register system collections
    manager.registeredCollections.set('versions', { collection: RecordVersions.collection, pluginSlug: 'system' });
    manager.registeredCollections.set('webhooks', { collection: WebhooksCollection.collection, pluginSlug: 'system' });

    for (const entry of Array.from(manager.registeredCollections.values()) as any[]) {
      if (entry.pluginSlug === 'system') await manager.schemaManager.syncCollection(entry.collection);
    }

    await manager.webhooks.initialize();

    // Start background services after migrations and system collections are ready
    await manager.scheduler.start();
    manager.security.start();
  }
}
