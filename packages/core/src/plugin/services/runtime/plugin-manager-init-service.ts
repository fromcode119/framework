import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { AppRoleGrantService } from '@core/database/app-role-grant-service';
import { Logger } from '@core/logging';
import { IDatabaseManager } from '@fromcode119/database';
import { MigrationManager } from '@core/database/migration-manager';
import { MigrationCoordinator } from '@core/management/migration-coordinator';
import { WorkflowService } from '@core/plugin/services/workflow-service';
import { PersonCatalogService } from '@core/plugin/services/people/person-catalog-service';
import { RecordVersions } from '@core/collections/record-versions';
import { WebhooksCollection } from '@core/collections/webhooks';
import { CertificateExpiryWarningTask } from '@core/certificates/certificate-expiry-warning-task';
import { CertificateIssuanceTask } from '@core/certificates/acme/certificate-issuance-task';
import { CertificateStoreService } from '@core/certificates/certificate-store-service';

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
    // Immediately after migrations, on the OWNER connection: whatever DDL just ran may have created
    // tables the runtime role has no rights to yet.
    await AppRoleGrantService.apply(this.manager.schemaDb);
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
    // Nobody else warns about a certificate running out — Let's Encrypt stopped sending expiry mail
    // in June 2025, and an uploaded certificate never had an issuer watching it at all.
    await manager.scheduler.register(CertificateExpiryWarningTask.NAME, CertificateExpiryWarningTask.SCHEDULE, async () => {
      await new CertificateExpiryWarningTask(new CertificateStoreService(manager.db), manager).run();
    }, { type: 'cron' });
    // Obtains and renews what the platform manages. Most passes do nothing: with no authority
    // declared it returns immediately. The per-host backoff, not this interval, rations attempts.
    await manager.scheduler.register(CertificateIssuanceTask.NAME, CertificateIssuanceTask.SCHEDULE, async () => {
      await new CertificateIssuanceTask(manager.db).run();
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

  /**
   * Seeds the default person catalogs, once per tenant.
   *
   * Deliberately NOT part of `init()`: `init()` runs the migrations that create `_system_tenants`,
   * and tenancy cannot be configured until they have. Seeding from inside it therefore ran while
   * `TenantMode` was still off, took the single-tenant path, and was refused by row-level security on
   * every boot — `person_catalogs` is tenant-scoped, a row written with no tenant gets a NULL
   * `tenant_id`, and the policy's `tenant_id = current_setting(...)` is then NULL, not TRUE.
   *
   * The caller runs it after `configureTenantMode()`, which is the first moment the answer exists.
   */
  async seedPeopleCatalogs(): Promise<void> {
    try {
      const catalogs = new PersonCatalogService(this.db as any);
      await PerTenantRun.forEach({
        label: 'people:seed-default-catalogs',
        db: this.db as any,
        work: () => catalogs.seedDefaults(),
      });
    } catch (error) {
      this.logger.warn(`[people] Failed to seed default person catalogs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
