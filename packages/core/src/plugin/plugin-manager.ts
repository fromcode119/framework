import { FromcodePlugin, LoadedPlugin, PluginContext, PluginManifest, Collection } from '../types';
import { SystemTable } from '@fromcode119/sdk/internal';
import { HookManager } from '../hooks/hook-manager';
import { QueueManager } from '../queue/queue-manager';
import { SchemaManager } from '../database/schema-manager';
import { MigrationManager } from '../database/migration-manager';
import { Logger } from '@fromcode119/sdk';
import { I18nManager } from '../i18n/i18n-manager';
import { DatabaseFactory, sql, IDatabaseManager } from '@fromcode119/database';
import { SchedulerService } from '@fromcode119/scheduler';
import { BackupService } from '../management/backup-service';
import { MigrationCoordinator } from '../management/migration-coordinator';
import { RecordVersions } from '../collections/record-versions';
import { AuditManager } from '../security/audit-manager';
import { SecurityMonitor } from '../security/security-monitor';
import { MarketplaceCatalogService } from '../marketplace/marketplace-catalog-service';
import { createHash } from 'crypto';
import { createPluginContext, PluginManagerInterface } from './context';
export { PluginManagerInterface };

import { getProjectRoot, getPluginsDir } from '../config/paths';

// Services
import { RuntimeService } from './services/runtime-service';
import { PluginStateService } from './services/plugin-state-service';
import { DiscoveryService } from './services/discovery-service';
import { AdminMetadataService } from './services/admin-metadata-service';
import { LifecycleService } from './services/lifecycle-service';
import { MiddlewareManager } from './services/middleware-manager';
import { WorkflowService } from './services/workflow-service';
import { WebhookService } from '../webhook/webhook-service';
import { WebhooksCollection } from '../collections/webhooks';
import { registry } from '@fromcode119/plugins';
import { IntegrationManager } from '../integrations';

export class PluginManager implements PluginManagerInterface {
  public audit: AuditManager;
  public security: SecurityMonitor;
  public marketplace: MarketplaceCatalogService;
  public plugins: Map<string, LoadedPlugin> = new Map();
  public apiHost: any = null;
  public hooks: HookManager = new HookManager();
  public db: IDatabaseManager;
  public jobs!: QueueManager;
  public scheduler!: SchedulerService;
  public i18n!: I18nManager;
  public integrations: IntegrationManager;

  public middlewares: MiddlewareManager = new MiddlewareManager();
  public auth: any = null;
  public webhooks: WebhookService;
  public headInjections: Map<string, any[]> = new Map();
  public logger = new Logger({ namespace: 'plugin-manager' });
  public registeredCollections: Map<string, { collection: Collection; pluginSlug: string }> = new Map();
  public pluginSettings: Map<string, any> = new Map();
  
  private coordinator: MigrationCoordinator;
  private schemaManager: SchemaManager;
  private migrationManager: MigrationManager;
  public projectRoot: string;
  public pluginsRoot: string;

  // Refactored Services
  public runtime: RuntimeService;
  public registry: PluginStateService;
  private discovery: DiscoveryService;
  private admin: AdminMetadataService;
  private lifecycle: LifecycleService;
  private workflow: WorkflowService;
  public get storage() { return this.integrations.storage; }
  public get email() { return this.integrations.email; }
  public get cache() { return this.integrations.cache; }

  constructor() {
    this.projectRoot = getProjectRoot();
    this.db = DatabaseFactory.create(process.env.DATABASE_URL || '');
    this.integrations = new IntegrationManager(this.db as any, this.projectRoot, this.logger);
    this.audit = new AuditManager(this.db);
    this.security = new SecurityMonitor(this.db, this);
    this.coordinator = new MigrationCoordinator(this.db);
    this.schemaManager = new SchemaManager(this.db);
    this.migrationManager = new MigrationManager(this.db);
    this.i18n = new I18nManager(process.env.DEFAULT_LOCALE || 'en');
    this.jobs = new QueueManager({ redisUrl: process.env.REDIS_URL });
    this.scheduler = new SchedulerService(this.db, { queueManager: this.jobs });
    this.workflow = new WorkflowService(this.db, this.hooks);
    this.webhooks = new WebhookService(this.db, this.hooks);
    // Forward every emitted hook event to the webhook dispatcher.
    this.hooks.on('*', (payload: any, event: string) => {
      this.webhooks.processEvent(event, payload).catch(err => this.logger.error(`Webhook delivery failed for ${event}:`, err));
    });

    // Initialize Global Plugin Registry for cohesion
    registry.setDatabase(this.db);

    this.pluginsRoot = getPluginsDir();

    // Initialize Services
    this.runtime = new RuntimeService(this.projectRoot);
    this.registry = new PluginStateService(this.db);
    this.discovery = new DiscoveryService(this.pluginsRoot, this.projectRoot);
    this.marketplace = new MarketplaceCatalogService(this.discovery);
    this.admin = new AdminMetadataService();
    this.lifecycle = new LifecycleService(this, this.registry, this.discovery, this.schemaManager);
  }

  async init() {
    await this.migrationManager.migrate();
    await this.coordinator.validateDatabaseState();
    await this.integrations.initialize();
    
    // Register background workers - MUST happen after migrations but before scheduler starts
    this.jobs.registerWorker('scheduler', async (job) => {
      const { taskName } = job.data;
      await this.scheduler.runHandler(taskName);
    });

    // Register global content workflow task - MUST happen after migrations
    await this.scheduler.register('content-workflows', '2m', async () => {
      await this.workflow.processScheduledContent(this.getCollections());
    });
    await this.scheduler.register('system-email-telemetry-weekly', '0 9 * * 1', async () => {
      await this.sendWeeklyEmailTelemetryDigest();
    }, { type: 'cron' });
    
    // Register system collections
    this.registeredCollections.set('versions', { collection: RecordVersions, pluginSlug: 'system' });
    this.registeredCollections.set('webhooks', { collection: WebhooksCollection, pluginSlug: 'system' });
    
    for (const entry of Array.from(this.registeredCollections.values())) {
      if (entry.pluginSlug === 'system') await this.schemaManager.syncCollection(entry.collection);
    }

    await this.webhooks.initialize();

    // Start background services after migrations and system collections are ready
    await this.scheduler.start();
    this.security.start();
  }

  async discoverPlugins() {
    const installedState = await this.registry.loadInstalledPluginsState();
    const { discovered, errored } = await this.discovery.discoverPlugins(this.plugins, installedState);

    // Add errored plugins to this.plugins
    for (const error of errored) {
      if (!this.plugins.has(error.manifest.slug)) {
        this.plugins.set(error.manifest.slug, {
          manifest: error.manifest,
          path: error.path,
          state: 'error',
          error: error.error,
          instanceId: `err-${error.manifest.slug}-${Date.now()}`
        } as any);
      }
    }

    try {
      const sorted = this.discovery.resolveDependencies(discovered.map(d => d.plugin));
      await this.coordinator.coordinate(sorted.map(p => p.manifest));

      for (const plugin of sorted) {
        const slug = plugin.manifest.slug;
        const stage = discovered.find(d => d.plugin.manifest.slug === slug);
        
        if (!stage) {
          this.logger.warn(`Plugin metadata found for ${slug} but path discovery failed.`);
          continue;
        }

        const existing = this.plugins.get(slug);
        if (existing && existing.state !== 'error') {
          continue;
        }

        try {
          await this.lifecycle.register(plugin, stage.path);
        } catch (err: any) {
          this.logger.error(`Failed to register plugin "${slug}": ${err.message}`);
          // Mark as errored in the local registry so it shows up in UI
          this.plugins.set(slug, {
            manifest: plugin.manifest,
            path: stage.path,
            state: 'error',
            error: err.message,
            instanceId: `err-reg-${slug}-${Date.now()}`
          } as any);
        }
      }
    } catch (err: any) {
      this.logger.error(`Plugin discovery coordination failed: ${err.message}`);
    }
  }

  async updatePlugin(slug: string, pkg?: any): Promise<void> {
    await this.installOrUpdateFromMarketplace(slug);
  }

  async installOrUpdateFromMarketplace(slug: string): Promise<PluginManifest> {
    const pkg = await this.marketplace.getPluginInfo(slug);
    if (!pkg) throw new Error(`Plugin "${slug}" not found in marketplace.`);

    const existing = this.plugins.get(slug);
    if (existing && existing.path) {
      this.logger.info(`Creating backup for ${slug} before update...`);
      await BackupService.create(slug, existing.path, 'plugins');
    }

    const manifest = await this.marketplace.downloadAndInstall(slug);
    
    // Refresh discovery
    await this.discoverPlugins();
    
    // Auto-enable if it was previously active (or if it's new, we'll let the controller decide)
    if (existing?.state === 'active') {
      await this.enable(slug);
    }
    
    return manifest;
  }

  /**
   * Shuts down all active plugin manager services.
   */
  async shutdown() {
    this.logger.info('Shutting down PluginManager services...');
    
    if (this.scheduler) {
      await this.scheduler.stop();
    }
    
    if (this.security) {
      this.security.stop();
    }
    
    if (this.jobs) {
      await this.jobs.close();
    }
    
    if (this.webhooks) {
        // Any cleanup for webhooks?
    }

    this.logger.info('PluginManager shutdown complete.');
  }

  // Delegate Lifecycle
  async enable(slug: string, options: { force?: boolean, recursive?: boolean } = {}) { return this.lifecycle.enable(slug, options); }
  async disable(slug: string) { return this.lifecycle.disable(slug); }
  async delete(slug: string) { return this.lifecycle.delete(slug); }
  async register(plugin: FromcodePlugin, path?: string) { return this.lifecycle.register(plugin, path); }

  async writeLog(level: string, message: string, pluginSlug?: string, context?: any) {
    await this.registry.writeLog(level, message, pluginSlug, context);
    this.notifyOnCriticalLog(level, message, pluginSlug, context).catch((error: any) => {
      this.logger.warn(`Email telemetry alert dispatch failed: ${error?.message || error}`);
    });
  }

  private async isEmailTelemetryEnabled(): Promise<boolean> {
    try {
      const row = await this.db.findOne(SystemTable.META, { key: 'email_notifications' });
      const raw = String(row?.value || '').trim().toLowerCase();
      if (!raw) return true;
      return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
    } catch {
      return true;
    }
  }

  private async getMetaValue(key: string): Promise<string> {
    try {
      const row = await this.db.findOne(SystemTable.META, { key });
      return String(row?.value || '').trim();
    } catch {
      return '';
    }
  }

  private async upsertMetaValue(key: string, value: string): Promise<void> {
    try {
      const existing = await this.db.findOne(SystemTable.META, { key });
      if (existing) {
        await this.db.update(SystemTable.META, { key }, { value });
      } else {
        await this.db.insert(SystemTable.META, { key, value });
      }
    } catch {
      // Best-effort telemetry metadata.
    }
  }

  private normalizeEmailAddress(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private parseRoles(value: any): string[] {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
      } catch {
        return raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
      }
    }
    return [];
  }

  private async getEmailTelemetryRecipients(): Promise<string[]> {
    const recipients = new Set<string>();

    const envRecipientsRaw =
      process.env.EMAIL_ALERT_TO ||
      process.env.ALERT_EMAIL_TO ||
      process.env.ADMIN_EMAILS ||
      process.env.ADMIN_EMAIL ||
      '';
    if (envRecipientsRaw) {
      for (const item of String(envRecipientsRaw).split(',')) {
        const normalized = this.normalizeEmailAddress(item);
        if (normalized) recipients.add(normalized);
      }
    }

    try {
      const users = await this.db.find('users', {
        columns: { email: true, roles: true },
        limit: 2000
      });
      for (const user of users || []) {
        const email = this.normalizeEmailAddress(user?.email);
        if (!email) continue;
        const roles = this.parseRoles(user?.roles);
        if (roles.includes('admin')) {
          recipients.add(email);
        }
      }
    } catch {
      // Ignore DB recipient lookup failures.
    }

    return Array.from(recipients);
  }

  private isCriticalLevel(level: string): boolean {
    const upper = String(level || '').trim().toUpperCase();
    return upper === 'ERROR' || upper === 'FATAL' || upper === 'CRITICAL' || upper === 'ALERT';
  }

  private async notifyOnCriticalLog(level: string, message: string, pluginSlug?: string, context?: any): Promise<void> {
    if (!this.isCriticalLevel(level)) return;
    if (!(await this.isEmailTelemetryEnabled())) return;

    const recipients = await this.getEmailTelemetryRecipients();
    if (!recipients.length) return;

    const signature = createHash('sha256')
      .update(`${String(level || '')}|${String(pluginSlug || '')}|${String(message || '')}`)
      .digest('hex')
      .slice(0, 24);
    const dedupeKey = `email_notifications:critical:${signature}`;
    const previousIso = await this.getMetaValue(dedupeKey);
    const previousAt = previousIso ? new Date(previousIso).getTime() : 0;
    const now = Date.now();
    const cooldownMs = 10 * 60 * 1000;
    if (previousAt && now - previousAt < cooldownMs) return;
    await this.upsertMetaValue(dedupeKey, new Date(now).toISOString());

    const appName = process.env.APP_NAME || 'Fromcode';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
    const pluginLabel = String(pluginSlug || 'system').trim() || 'system';
    const headline = String(message || '').trim() || 'Critical system log entry';
    const shortHeadline = headline.length > 140 ? `${headline.slice(0, 137)}...` : headline;
    const contextText = context ? JSON.stringify(context, null, 2) : '(none)';
    const timestamp = new Date(now).toISOString();

    const subject = `${appName}: Critical Alert [${pluginLabel}]`;
    const text =
`A critical log event was captured.

Time (UTC): ${timestamp}
Level: ${String(level || '').toUpperCase()}
Plugin: ${pluginLabel}
Message: ${headline}

Context:
${contextText}
`;
    const html = `<p><strong>A critical log event was captured.</strong></p>
<ul>
  <li><strong>Time (UTC):</strong> ${timestamp}</li>
  <li><strong>Level:</strong> ${String(level || '').toUpperCase()}</li>
  <li><strong>Plugin:</strong> ${pluginLabel}</li>
  <li><strong>Message:</strong> ${shortHeadline}</li>
</ul>
<p><strong>Context</strong></p>
<pre style="white-space:pre-wrap;background:#0b1020;color:#e2e8f0;padding:12px;border-radius:8px;">${contextText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;

    await this.email.send({
      to: recipients.join(','),
      from: fromAddress,
      subject,
      text,
      html
    });
  }

  private async sendWeeklyEmailTelemetryDigest(): Promise<void> {
    if (!(await this.isEmailTelemetryEnabled())) return;

    const recipients = await this.getEmailTelemetryRecipients();
    if (!recipients.length) return;

    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const rows = await this.db.find(SystemTable.LOGS, {
      orderBy: 'timestamp DESC',
      limit: 2000
    }).catch(() => []);

    const recent = (rows || []).filter((row: any) => {
      const ts = new Date(row?.timestamp || 0).getTime();
      return Number.isFinite(ts) && ts >= weekAgo;
    });

    const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const levelCounts: Record<string, number> = {};
    for (const level of levels) levelCounts[level] = 0;

    const pluginCounts: Record<string, number> = {};
    for (const row of recent) {
      const level = String(row?.level || '').toUpperCase();
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      const plugin = String(row?.plugin_slug || row?.pluginSlug || 'system').trim() || 'system';
      pluginCounts[plugin] = (pluginCounts[plugin] || 0) + 1;
    }

    const topPlugins = Object.entries(pluginCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const criticalRows = recent
      .filter((row: any) => this.isCriticalLevel(String(row?.level || '')))
      .slice(0, 8);

    const appName = process.env.APP_NAME || 'Fromcode';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
    const fromIso = new Date(weekAgo).toISOString();
    const toIso = new Date(now).toISOString();

    const topPluginsText = topPlugins.length
      ? topPlugins.map(([slug, count]) => `- ${slug}: ${count}`).join('\n')
      : '- (no activity)';
    const criticalText = criticalRows.length
      ? criticalRows.map((row: any) =>
          `- [${String(row?.timestamp || '')}] ${String(row?.plugin_slug || 'system')} ${String(row?.level || '')}: ${String(row?.message || '')}`
        ).join('\n')
      : '- (none)';

    const subject = `${appName}: Weekly System Summary`;
    const text =
`System telemetry summary for ${fromIso} -> ${toIso}

Total log entries: ${recent.length}
Levels:
- ERROR: ${levelCounts.ERROR || 0}
- WARN: ${levelCounts.WARN || 0}
- INFO: ${levelCounts.INFO || 0}
- DEBUG: ${levelCounts.DEBUG || 0}

Top active plugins:
${topPluginsText}

Recent critical entries:
${criticalText}
`;

    const htmlTopPlugins = topPlugins.length
      ? `<ul>${topPlugins.map(([slug, count]) => `<li><strong>${slug}</strong>: ${count}</li>`).join('')}</ul>`
      : `<p>(no activity)</p>`;
    const htmlCritical = criticalRows.length
      ? `<ul>${criticalRows.map((row: any) => `<li><strong>${String(row?.timestamp || '')}</strong> [${String(row?.plugin_slug || 'system')}] ${String(row?.level || '')}: ${String(row?.message || '')}</li>`).join('')}</ul>`
      : `<p>(none)</p>`;

    const html = `<p><strong>System telemetry summary</strong></p>
<p>Window: ${fromIso} -> ${toIso}</p>
<p>Total log entries: <strong>${recent.length}</strong></p>
<ul>
  <li>ERROR: <strong>${levelCounts.ERROR || 0}</strong></li>
  <li>WARN: <strong>${levelCounts.WARN || 0}</strong></li>
  <li>INFO: <strong>${levelCounts.INFO || 0}</strong></li>
  <li>DEBUG: <strong>${levelCounts.DEBUG || 0}</strong></li>
</ul>
<p><strong>Top active plugins</strong></p>
${htmlTopPlugins}
<p><strong>Recent critical entries</strong></p>
${htmlCritical}`;

    await this.email.send({
      to: recipients.join(','),
      from: fromAddress,
      subject,
      text,
      html
    });
  }

  public async sendTestEmailTelemetry(triggeredBy?: { id?: string | number; email?: string; roles?: string[] }): Promise<{ sent: boolean; recipientsCount: number }> {
    if (!(await this.isEmailTelemetryEnabled())) {
      throw new Error('Email telemetry is disabled. Enable it in Settings > General first.');
    }

    const recipients = await this.getEmailTelemetryRecipients();
    if (!recipients.length) {
      throw new Error('No telemetry recipients are configured.');
    }

    const nowIso = new Date().toISOString();
    const appName = process.env.APP_NAME || 'Fromcode';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
    const actorEmail = this.normalizeEmailAddress(triggeredBy?.email) || 'unknown';
    const actorId = String(triggeredBy?.id || '').trim() || 'unknown';
    const actorRoles = Array.isArray(triggeredBy?.roles) ? triggeredBy.roles.join(', ') : '';

    const subject = `${appName}: Telemetry Test Email`;
    const text =
`This is a test telemetry email from ${appName}.

Time (UTC): ${nowIso}
Triggered by user id: ${actorId}
Triggered by email: ${actorEmail}
Roles: ${actorRoles || '(none)'}

If you received this message, your configured Email integration is working for telemetry delivery.
`;
    const html = `<p><strong>This is a test telemetry email from ${appName}.</strong></p>
<ul>
  <li><strong>Time (UTC):</strong> ${nowIso}</li>
  <li><strong>Triggered by user id:</strong> ${actorId}</li>
  <li><strong>Triggered by email:</strong> ${actorEmail}</li>
  <li><strong>Roles:</strong> ${actorRoles || '(none)'}</li>
</ul>
<p>If you received this message, your configured Email integration is working for telemetry delivery.</p>`;

    await this.email.send({
      to: recipients.join(','),
      from: fromAddress,
      subject,
      text,
      html
    });

    return { sent: true, recipientsCount: recipients.length };
  }

  async savePluginConfig(slug: string, config: any) {
    await this.registry.savePluginConfig(slug, config);
    const plugin = this.plugins.get(slug);
    if (plugin) {
      plugin.manifest.config = config;
    }
  }

  async saveSandboxConfig(slug: string, config: any) {
    const { systemPlugins, eq } = require('@fromcode119/database');
    const isExplicitlyDisabled = config === false || (config && typeof config === 'object' && config.enabled === false);
    const normalizedConfig = isExplicitlyDisabled
      ? false
      : (config && typeof config === 'object'
          ? Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'enabled'))
          : {});

    await (this.db as any).update(systemPlugins, { slug }, { 
      sandboxConfig: normalizedConfig 
    });
    
    const plugin = this.plugins.get(slug);
    if (plugin) {
      // Update manifest representation
      if (normalizedConfig === false) {
        plugin.manifest.sandbox = false;
      } else {
        if (!plugin.manifest.sandbox || typeof plugin.manifest.sandbox === 'boolean') {
          plugin.manifest.sandbox = normalizedConfig;
        } else {
          plugin.manifest.sandbox = { ...plugin.manifest.sandbox, ...normalizedConfig };
        }
      }
    }
    
    this.logger.info(`Sandbox configuration updated for plugin: ${slug}`);
  }

  public getHeadInjections(slug: string): any[] {
    return this.headInjections.get(slug.toLowerCase()) || [];
  }

  getCollections() {
    return Array.from(this.registeredCollections.values()).map(c => c.collection);
  }

  getCollection(slug: string) {
    const entry = this.registeredCollections.get(slug);
    if (entry) return entry;

    // Case-insensitive fallback
    const lowerSlug = slug.toLowerCase();
    for (const [key, val] of this.registeredCollections.entries()) {
      if (key.toLowerCase() === lowerSlug) return val;
    }
    
    return undefined;
  }

  public registerPluginSettings(pluginSlug: string, schema: any): void {
    this.pluginSettings.set(pluginSlug.toLowerCase(), schema);
    this.logger.info(`Settings registered for plugin: ${pluginSlug}`);
  }

  public getPluginSettings(pluginSlug: string): any | undefined {
    return this.pluginSettings.get(pluginSlug.toLowerCase());
  }

  public getAllPluginSettings(): Map<string, any> {
    return new Map(this.pluginSettings);
  }

  async installFromZip(filePath: string, pluginsRoot?: string): Promise<PluginManifest> {
    return this.discovery.installFromZip(filePath);
  }

  async disableWithError(slug: string, message: string): Promise<void> {
    const plugin = this.plugins.get(slug);
    if (plugin) {
      plugin.state = 'error';
      await this.db.update(SystemTable.PLUGINS, { slug }, { state: 'error', health_status: 'error', updated_at: new Date() });
    }
  }

  public async getSecuritySummary() {
    const allPlugins = this.getPlugins();
    const activePlugins = allPlugins.filter((plugin) => plugin.state === 'active');
    const isSandboxPolicyEnabled = (plugin: LoadedPlugin) => plugin.manifest?.sandbox !== false;
    const sandboxConfigured = allPlugins.filter(isSandboxPolicyEnabled);
    const sandboxActive = activePlugins.filter(isSandboxPolicyEnabled);
    const sandboxRuntimeActive = activePlugins.filter((plugin) => !!plugin.isSandboxed);
    const unsandboxedActive = activePlugins.filter((plugin) => !isSandboxPolicyEnabled(plugin));
    const sandboxPolicyRuntimeMismatch = sandboxActive.filter((plugin) => !plugin.isSandboxed);
    const sandbox = await this.lifecycle.getSandboxStats();
    const processMemory = process.memoryUsage();
    const sandboxHeapUsedBytes = Number(sandbox?.heap?.used_heap_size || 0);
    const otherNonIsolateAllocationsEstimateBytes = Math.max(0, processMemory.rss - sandboxHeapUsedBytes);

    return {
      sandbox,
      hostMemory: {
        rssBytes: processMemory.rss,
        heapTotalBytes: processMemory.heapTotal,
        heapUsedBytes: processMemory.heapUsed,
        externalBytes: processMemory.external,
        arrayBuffersBytes: processMemory.arrayBuffers || 0,
        dbNetworkBuffersEstimateBytes: processMemory.arrayBuffers || 0,
        otherNonIsolateAllocationsEstimateBytes
      },
      monitor: await this.security.getSecurityStats(),
      pluginIsolation: {
        totalPlugins: allPlugins.length,
        activePlugins: activePlugins.length,
        sandboxConfiguredPlugins: sandboxConfigured.length,
        sandboxActivePlugins: sandboxActive.length,
        sandboxRuntimeActivePlugins: sandboxRuntimeActive.length,
        sandboxPolicyRuntimeMismatchPlugins: sandboxPolicyRuntimeMismatch.length,
        sandboxPolicyRuntimeMismatchSlugs: sandboxPolicyRuntimeMismatch.map((plugin) => plugin.manifest.slug),
        unsandboxedActivePlugins: unsandboxedActive.length,
        unsandboxedActivePluginSlugs: unsandboxedActive.map((plugin) => plugin.manifest.slug)
      },
      integrityEnforced: true,
      signatureEnforced: !!process.env.REQUIRE_SIGNATURES
    };
  }

  /**
   * Returns plugins in topological order based on their dependencies.
   * If a list of plugins is provided, it sorts that list; otherwise, it sorts all known plugins.
   */
  public getSortedPlugins(pluginsToSort?: LoadedPlugin[]): LoadedPlugin[] {
    const list = pluginsToSort || Array.from(this.plugins.values());
    try {
      return this.discovery.resolveDependencies(list as any) as LoadedPlugin[];
    } catch (err: any) {
      this.logger.warn(`Topological sort failed: ${err.message}. Returning unsorted list.`);
      return list;
    }
  }

  getRuntimeModules() { return this.runtime.getModules(this.getPlugins().filter(p => p.state === 'active')); }
  getAdminMetadata() { 
    return this.admin.getAdminMetadata(
      this.getSortedPlugins(), 
      this.registeredCollections, 
      this.getRuntimeModules()
    ); 
  }

  getImportMap() {
    const modules = this.getRuntimeModules();
    const imports: Record<string, string> = {};
    
    Object.entries(modules).forEach(([name, mod]: [string, any]) => {
       if (mod.url) {
         imports[name] = mod.url;
       } else if (mod.source) {
         imports[name] = `data:text/javascript;base64,${mod.source}`;
       }
    });

    return { imports };
  }

  // Rest of the methods...
  createContext(plugin: LoadedPlugin): PluginContext { return createPluginContext(plugin, this, this.logger); }
  getPlugins(): LoadedPlugin[] { return Array.from(this.plugins.values()); }
  setAuth(auth: any) { this.auth = auth; }
  setApiHost(host: any) { this.apiHost = host; }

  emit(event: string, payload: any) { 
    this.hooks.emit(event, payload);
  }

  async close() {
    const activePlugins = this.getPlugins().filter(plugin => plugin.state === 'active');
    const shutdownOrder = this.getSortedPlugins(activePlugins).reverse();

    for (const plugin of shutdownOrder) {
      try {
        await this.disable(plugin.manifest.slug);
      } catch (err: any) {
        this.logger.warn(`Failed to disable plugin "${plugin.manifest.slug}" during shutdown: ${err?.message || err}`);
      }
    }
    this.scheduler.stop();
    this.security.stop();
    await this.jobs.close();
  }
}
