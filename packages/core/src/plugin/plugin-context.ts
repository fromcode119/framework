import { InjectionTarget } from '@core/enums/injection-target.enum';
import { ScheduleType } from '@fromcode119/scheduler';
import { RuntimeModuleKind } from '@core/plugin/services/enums/runtime-module-kind.enum';
import { ExtensionKind } from '@core/plugin/enums/extension-kind.enum';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import type { IPluginContextDb } from '@core/plugin/interfaces/plugin-context-db.interface';
import type { IMediaManager } from '@fromcode119/media';
import type { IEmailDriver } from '@fromcode119/email';
import type { ICacheManager } from '@fromcode119/cache';
import { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IPluginSettingsSchema } from '@core/plugin/interfaces/plugin-settings-schema.interface';
import type { IEntityParseOptions } from '@core/entity/interfaces/entity-parse-options.interface';
import type { IEntityParseResult } from '@core/entity/interfaces/entity-parse-result.interface';
import type { IMiddlewareConfig } from '@core/interfaces/middleware-config.interface';
import type { IPluginHealthProbeResult } from '@core/plugin/interfaces/plugin-health-probe-result.interface';
import type { NamespacedPluginsFacade } from '@core/plugin/namespaced-plugins-facade';
import type { IPluginContextHooks } from '@core/plugin/interfaces/plugin-context-hooks.interface';
import type { IPluginContextAuth } from '@core/plugin/interfaces/plugin-context-auth.interface';
import type { IPluginPathReadOptions } from '@core/plugin/interfaces/plugin-path-read-options.interface';
import type { IPluginContextApi } from '@core/plugin/interfaces/plugin-context-api.interface';
import type { IPluginContextLogger } from '@core/plugin/interfaces/plugin-context-logger.interface';
import type { IPluginContextIntegrations } from '@core/plugin/interfaces/plugin-context-integrations.interface';
import type { IPluginContextMcp } from '@core/plugin/interfaces/plugin-context-mcp.interface';
import type { IPluginContextJobs } from '@core/plugin/interfaces/plugin-context-jobs.interface';
import type { IPluginContextScheduler } from '@core/plugin/interfaces/plugin-context-scheduler.interface';
import type { IPluginContextPlugin } from '@core/plugin/interfaces/plugin-context-plugin.interface';
import type { IPluginContextPaths } from '@core/plugin/interfaces/plugin-context-paths.interface';
import type { IPluginContextPlugins } from '@core/plugin/interfaces/plugin-context-plugins.interface';
import type { IPluginContextDependencies } from '@core/plugin/interfaces/plugin-context-dependencies.interface';
import type { IPluginContextExtensions } from '@core/plugin/interfaces/plugin-context-extensions.interface';
import type { IPluginContextCollections } from '@core/plugin/interfaces/plugin-context-collections.interface';
import type { IPluginContextEntities } from '@core/plugin/interfaces/plugin-context-entities.interface';
import type { IPluginContextSettings } from '@core/plugin/interfaces/plugin-context-settings.interface';
import type { IPluginContextI18n } from '@core/plugin/interfaces/plugin-context-i18n.interface';
import type { IPluginContextSecrets } from '@core/plugin/interfaces/plugin-context-secrets.interface';
import type { IPluginContextUi } from '@core/plugin/interfaces/plugin-context-ui.interface';
import type { IPluginContextRuntime } from '@core/plugin/interfaces/plugin-context-runtime.interface';
import type { IPluginContextNotifications } from '@core/plugin/interfaces/plugin-context-notifications.interface';
import type { IPluginContextUsers } from '@core/plugin/interfaces/plugin-context-users.interface';
import type { IPluginContextPeople } from '@core/plugin/interfaces/plugin-context-people.interface';
import type { IPluginContextEntityRecords } from '@core/plugin/interfaces/plugin-context-entity-records.interface';
import type { IPluginContextMeta } from '@core/plugin/interfaces/plugin-context-meta.interface';
import type { IPluginContextMedia } from '@core/plugin/interfaces/plugin-context-media.interface';
import type { IPluginContextRecordVersions } from '@core/plugin/interfaces/plugin-context-record-versions.interface';
import type { IPluginContextRoles } from '@core/plugin/interfaces/plugin-context-roles.interface';
import type { IPluginContextTheme } from '@core/plugin/interfaces/plugin-context-theme.interface';

export class PluginContext {
  declare readonly db: IPluginContextDb;
  declare readonly api: IPluginContextApi;
  declare readonly hooks: IPluginContextHooks;
  declare readonly auth: IPluginContextAuth;
  declare readonly logger: IPluginContextLogger;

  declare readonly integrations: IPluginContextIntegrations;

  /** Framework MCP registry — a plugin registers only `<its-slug>.*` tools; see IPluginContextMcp. */
  declare readonly mcp: IPluginContextMcp;

  /**
   * Shortcuts for core integrations
   */
  declare readonly storage: IMediaManager;
  /** The platform mailer. `IEmailDriver` is the email package's OWN contract — core previously
   *  declared a local `EmailManager` stub whose `to: string` contradicted the real `string | string[]`. */
  declare readonly email: IEmailDriver;
  declare readonly cache: ICacheManager;

  declare readonly redis: any;
  declare readonly fetch: (url: string, init?: any) => Promise<any>;
  declare readonly jobs: IPluginContextJobs;

  declare readonly scheduler: IPluginContextScheduler;

  declare readonly plugin: IPluginContextPlugin;

  declare readonly paths: IPluginContextPaths;

  declare readonly plugins: IPluginContextPlugins;

  declare readonly dependencies: IPluginContextDependencies;

  declare readonly extensions: IPluginContextExtensions;

  // Content Management
  declare readonly collections: IPluginContextCollections;

  declare readonly entities: IPluginContextEntities;

  // Plugin Settings
  declare readonly settings: IPluginContextSettings;

  declare readonly i18n: IPluginContextI18n;

  /** Credentials at rest, on the framework's key — so no plugin ships an encryption scheme. */
  declare readonly secrets: IPluginContextSecrets;

  /** Installable versions this plugin offers, merged into the catalogue the admin already reads. */
  declare readonly catalog: {
    contribute(list: () => Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>): void;
    withdraw(): void;
  };

  /**
   * Shortcut for i18n.t. Optional `locale` renders in a specific language (e.g. a customer's locale for an
   * order email) instead of the platform default.
   */
  declare readonly t: (key: string, params?: Record<string, any>, locale?: string) => string;

  declare readonly ui: IPluginContextUi;

  declare readonly runtime: IPluginContextRuntime;

  /**
   * Platform notifications. The framework owns BOTH recipient resolution AND delivery — a plugin
   * supplies only the message content; it never resolves users/roles or loops over recipients itself.
   * This is the sanctioned replacement for any plugin-local "find the admins and email each one" code.
   */
  declare readonly notifications: IPluginContextNotifications;

  declare readonly users: IPluginContextUsers;

  /**
   * Canonical person/identity surface (the `people` table). Serves account holders,
   * family members, and email-only contacts. Use instead of querying SystemTable.PEOPLE
   * or any plugin-local people store directly.
   */
  declare readonly people: IPluginContextPeople;

  /**
   * Entity-records registry. Register a provider that returns the records this
   * plugin owns for a given person (invoices, declarations, agreements, orders, …).
   * The framework aggregates every plugin's records into one grouped timeline for
   * the Person 360 / partner-CRM view. namespace + slug are taken from the manifest.
   */
  declare readonly entityRecords: IPluginContextEntityRecords;

  /**
   * "Needs you" registry. Register a provider returning what THIS plugin considers unfinished work
   * for the dashboard's attention list — orders nobody fulfilled, submissions nobody answered.
   * Called on dashboard load, so it must be one cheap query; slow providers are dropped.
   */
  declare readonly attention: {
    registerProvider(input: { key: string; label: string; resolve: () => Promise<unknown[]> | unknown[] }): void;
    unregister(key: string): void;
  };

  /**
   * Read-only access to the system meta store.
   * Use instead of querying SystemTable.META directly.
   */
  declare readonly meta: IPluginContextMeta;
  /**
   * Run this plugin's schema migrations on the FRAMEWORK's DDL connection.
   *
   * The request connection is a non-owner role and cannot ALTER tables, so a plugin that runs its
   * own DDL through `context.db` fails with "must be owner of table …". Plugins declare WHAT to
   * migrate; the framework decides which connection runs it, and audits the run.
   */
  declare readonly migrations: { run: (migrations: Array<{ up: (db: any) => Promise<void> }>) => Promise<void> };

  /**
   * Read-only access to the system media library. Use instead of querying SystemTable.MEDIA directly.
   */
  declare readonly media: IPluginContextMedia;

  /**
   * Read-only access to framework-managed record versions (SystemTable.RECORD_VERSIONS).
   * Use instead of querying the system table directly.
   */
  declare readonly recordVersions: IPluginContextRecordVersions;

  /**
   * Role management helpers.
   * Use instead of querying SystemTable.ROLES directly.
   */
  declare readonly roles: IPluginContextRoles;

  declare readonly theme: IPluginContextTheme;
}
