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
import { SitePreviewGrantService } from '@core/tenant/preview/site-preview-grant-service';
import { SystemConstants } from '@core/constants/system.constants';
import { SetupMode } from '@core/tenant/setup-mode';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { DatabaseRoleGuard } from '@core/tenant/database-role-guard';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';

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
    // Preview grants are minutes long and the sessions they become are hours long, so the table is
    // almost always empty — but nothing else deletes a row, and a table nobody sweeps is a table that
    // grows for the life of the deployment. Hourly, because that is the granularity that matters.
    // Once per tenant: the rows are tenant-owned, so an untenanted sweep reads an empty table under
    // row-level security and deletes nothing — the table would grow for the life of the deployment
    // while the timer reported success every hour.
    await manager.scheduler.register('site-preview-grant-sweep', '0 * * * *', async () => {
      await PerTenantRun.forEach({
        label: 'site-preview-grant-sweep',
        db: manager.db,
        work: async () => { await new SitePreviewGrantService(manager.db).prune(); },
      });
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

  /**
   * Decides once, at the same point and from the same connection, whether this deployment has ever
   * been set up — and may therefore still be claimed.
   *
   * Every signal must say "untouched": no users, no tenants, no console address, no completion
   * marker. Deleting one table does not reopen setup; only a genuinely fresh database does. A read
   * that FAILS is treated as "already set up", because the safe answer to "may a stranger claim this
   * platform" is no — the opposite of how the tenant count above is handled, and for the opposite
   * reason.
   */
  private async configureSetupMode(tenantCount: number): Promise<void> {
    try {
      const userCount = await this.manager.schemaDb.count(SystemConstants.TABLE.USERS);
      const adminHost = await this.readPlatformSetting(SystemConstants.META_KEY.ADMIN_URL);
      const completed = await this.readPlatformSetting(SystemConstants.META_KEY.SETUP_COMPLETED);

      SetupMode.configure({
        userCount: Number(userCount || 0),
        tenantCount,
        adminHostConfigured: adminHost.length > 0,
        setupCompleted: completed === 'true',
      });
    } catch (error: unknown) {
      SetupMode.configure({ userCount: 1, tenantCount, adminHostConfigured: true, setupCompleted: true });
      this.logger.warn(`Could not determine setup state, treating this deployment as set up: ${String((error as Error)?.message ?? error)}`);
    }
  }

  /** One platform-row setting, read straight from the table — no cache exists this early in boot. */
  private async readPlatformSetting(key: string): Promise<string> {
    const row = await this.manager.schemaDb.findOne(SystemConstants.TABLE.META, { key });
    return String((row as any)?.value ?? '').trim();
  }

  /**
   * Decides once, after migrations have run, whether this deployment is multi-tenant — and refuses
   * to continue if it is multi-tenant on a driver that cannot isolate, or on a connection that
   * bypasses row-level security.
   *
   * Runs AFTER bootstrap because `_system_tenants` only exists once migration 020 has run. A
   * deployment with no tenant rows stays single-tenant and skips both checks: it behaves exactly as
   * it did before tenancy existed, on any driver.
   */
  async configureTenantMode(): Promise<void> {
    // Failure to read the tenancy registry must stop startup. Treating a database error as
    // "zero tenants" silently disabled RLS checks and could start a multi-tenant deployment on
    // the privileged migration connection.
    const tenants = await this.manager.schemaDb.count(SystemConstants.TABLE.TENANTS);

    TenantMode.configure({
      tenantCount: Number(tenants || 0),
      dialect: String(this.db.dialect || ''),
      isolationSupported: this.db.supportsTenantIsolation(),
    });

    await this.configureSetupMode(Number(tenants || 0));

    // The tenant axis of plugin enablement reads on the REQUEST connection, like every other
    // per-request lookup — not the owner connection, which exists only for DDL.
    PluginTenantAccess.configure(this.db);

    // Only meaningful once tenants exist: a single-tenant deployment has nothing to isolate, and
    // demanding a least-privilege role there would break every existing installation.
    if (TenantMode.isEnabled()) {
      await DatabaseRoleGuard.assertNotPrivileged(this.db as any);
    }
  }

  /**
   * Records columns the database has that nothing declares — a proposal queue, never an action.
   *
   * A plugin that is not ACTIVE registers no collections, so its tables yield no findings this pass.
   * Its table names are passed through so the queue is not pruned as though the debt were resolved.
   */
  async auditUndeclaredColumns(): Promise<void> {
    const inactive = [...this.manager.plugins.values()].filter((plugin) => plugin.state !== PluginState.ACTIVE);
    const registered = new Set([...this.manager.registeredCollections.values()].map((entry) => entry.collection.slug));
    const absentTables = (await this.manager.schemaManager.listTables())
      .filter((table) => !registered.has(table))
      .filter((table) => inactive.some((plugin) => table.startsWith(`fcp_${String(plugin.manifest.slug).replace(/-/g, '_')}_`)));

    await this.manager.schemaManager.recordUndeclaredColumns(
      [...this.manager.registeredCollections.values()].map((entry) => ({
        collection: entry.collection,
        pluginSlug: entry.pluginSlug,
      })),
      inactive.map((plugin) => plugin.manifest.slug),
      absentTables,
    );
  }
}
