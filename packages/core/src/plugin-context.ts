import { InjectionTarget } from '@core/enums/injection-target.enum';
import { ScheduleType } from '@fromcode119/scheduler';
import { RuntimeModuleKind } from '@core/plugin/services/enums/runtime-module-kind.enum';
import { ExtensionKind } from '@core/plugin/enums/extension-kind.enum';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import type { IDatabaseManager } from '@core/interfaces/database-manager.interface';
import type { IMediaManager } from '@fromcode119/media';
import type { IEmailDriver } from '@fromcode119/email';
import type { ICacheManager } from '@fromcode119/cache';
import { ICollection } from '@core/interfaces/collection.interface';
import type { IPluginSettingsSchema } from '@core/interfaces/plugin-settings-schema.interface';
import type { IEntityParseOptions } from '@core/interfaces/entity-parse-options.interface';
import type { IEntityParseResult } from '@core/interfaces/entity-parse-result.interface';
import type { IMiddlewareConfig } from '@core/interfaces/middleware-config.interface';
import type { IPluginHealthProbeResult } from '@core/interfaces/plugin-health-probe-result.interface';
import type { NamespacedPluginsFacade } from '@core/namespaced-plugins-facade';
import type { IPluginContextHooks } from '@core/interfaces/plugin-context-hooks.interface';
import type { IPluginContextAuth } from '@core/interfaces/plugin-context-auth.interface';
import type { IPluginPathReadOptions } from '@core/interfaces/plugin-path-read-options.interface';
import type { IPluginContextApi } from '@core/interfaces/plugin-context-api.interface';
import type { IPluginContextLogger } from '@core/interfaces/plugin-context-logger.interface';
import type { IPluginContextIntegrations } from '@core/interfaces/plugin-context-integrations.interface';
import type { IPluginContextJobs } from '@core/interfaces/plugin-context-jobs.interface';
import type { IPluginContextScheduler } from '@core/interfaces/plugin-context-scheduler.interface';
import type { IPluginContextPlugin } from '@core/interfaces/plugin-context-plugin.interface';
import type { IPluginContextPaths } from '@core/interfaces/plugin-context-paths.interface';
import type { IPluginContextPlugins } from '@core/interfaces/plugin-context-plugins.interface';
import type { IPluginContextDependencies } from '@core/interfaces/plugin-context-dependencies.interface';
import type { IPluginContextExtensions } from '@core/interfaces/plugin-context-extensions.interface';
import type { IPluginContextCollections } from '@core/interfaces/plugin-context-collections.interface';
import type { IPluginContextEntities } from '@core/interfaces/plugin-context-entities.interface';
import type { IPluginContextSettings } from '@core/interfaces/plugin-context-settings.interface';
import type { IPluginContextI18n } from '@core/interfaces/plugin-context-i18n.interface';
import type { IPluginContextUi } from '@core/interfaces/plugin-context-ui.interface';
import type { IPluginContextRuntime } from '@core/interfaces/plugin-context-runtime.interface';
import type { IPluginContextNotifications } from '@core/interfaces/plugin-context-notifications.interface';
import type { IPluginContextUsers } from '@core/interfaces/plugin-context-users.interface';
import type { IPluginContextPeople } from '@core/interfaces/plugin-context-people.interface';
import type { IPluginContextEntityRecords } from '@core/interfaces/plugin-context-entity-records.interface';
import type { IPluginContextMeta } from '@core/interfaces/plugin-context-meta.interface';
import type { IPluginContextMedia } from '@core/interfaces/plugin-context-media.interface';
import type { IPluginContextRecordVersions } from '@core/interfaces/plugin-context-record-versions.interface';
import type { IPluginContextRoles } from '@core/interfaces/plugin-context-roles.interface';
import type { IPluginContextTheme } from '@core/interfaces/plugin-context-theme.interface';

export class PluginContext {
  declare readonly db: IDatabaseManager;
  declare readonly api: IPluginContextApi;
  declare readonly hooks: IPluginContextHooks;
  declare readonly auth: IPluginContextAuth;
  declare readonly logger: IPluginContextLogger;

  declare readonly integrations: IPluginContextIntegrations;

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
   * Read-only access to the system meta store.
   * Use instead of querying SystemTable.META directly.
   */
  declare readonly meta: IPluginContextMeta;

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
