import { IDatabaseManager, IMediaManager, IEmailManager, ICacheManager } from './managers.interfaces';
import { Collection, PluginSettingsSchema } from './schema.interfaces';
import type { CollectionInput } from './schema.types';
import type { EntityParseOptions, EntityParseResult } from './entity.interfaces';
import { MiddlewareConfig } from './manifests.interfaces';
import type { PluginHealthProbeResult } from '../plugin-health-route-handler.interfaces';
import type { NamespacedPluginsFacade } from '../namespaced-plugins-facade';
import { PluginContextHooks, PluginContextAuth, PluginPathReadOptions } from './plugin-context-support.interfaces';

export interface PluginContext {
  readonly db: IDatabaseManager;
  readonly api: {
    get(path: string, ...handlers: any[]): void;
    health(probe?: () => PluginHealthProbeResult | Promise<PluginHealthProbeResult>): void;
    post(path: string, ...handlers: any[]): void;
    put(path: string, ...handlers: any[]): void;
    delete(path: string, ...handlers: any[]): void;
    patch(path: string, ...handlers: any[]): void;
    status(probe?: () => PluginHealthProbeResult | Promise<PluginHealthProbeResult>): void;
    use(path: string, ...handlers: any[]): void;
    registerMiddleware(config: MiddlewareConfig): void;
  };
  readonly hooks: PluginContextHooks;
  readonly auth: PluginContextAuth;
  readonly logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };

  readonly integrations: {
    /**
     * Register a new integration type (e.g. 'payment', 'search', 'sms')
     */
    registerType(definition: {
      key: string;
      label: string;
      description?: string;
      defaultProvider: string;
      providers?: any[];
      resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
    }): void;

    /**
     * Register a new provider for an existing integration type
     */
    registerProvider(typeKey: string, provider: {
      key: string;
      label: string;
      description?: string;
      fields?: any[];
      create: (config: Record<string, any>) => any | Promise<any>;
      normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
    }): void;

    /**
     * Resolve and instantiate an integration by its type key
     */
    get<T = any>(typeKey: string): Promise<T>;

    /**
     * Resolve and instantiate an integration from a specific provider config.
     * Stored password fields are decrypted before provider creation.
     */
    instantiateWithConfig<T = any>(
      typeKey: string,
      providerKey: string,
      config?: Record<string, any>
    ): Promise<{ instance: T; resolved: any }>;
  };

  /**
   * Shortcuts for core integrations
   */
  readonly storage: IMediaManager;
  readonly email: IEmailManager;
  readonly cache: ICacheManager;

  readonly redis: any;
  readonly fetch: (url: string, init?: any) => Promise<any>;
  readonly jobs: {
    worker(processor: (job: any) => Promise<any>, options?: any): void;
    add(name: string, data: any, options?: any): Promise<any>;
  };

  readonly scheduler: {
    /**
     * Register a task with a specific schedule (Cron or Interval)
     */
    register(name: string, schedule: string, handler: (data?: any) => Promise<void>, options?: { type?: 'cron' | 'interval' }): Promise<void>;

    /**
     * Run a task immediately
     */
    runNow(name: string): Promise<void>;

    /**
     * Schedule a one-time task (conceptually, would likely enqueue a Job)
     */
    schedule(name: string, when: Date | string, data: any): Promise<void>;
  };

  readonly plugin: {
    slug: string;
    namespace: string;
    version: string;
    dataDir: string;
    rootDir: string;
    config: Record<string, any>;
  };

  readonly paths: {
    frameworkRoot: string;
    pluginsRoot: string;
    themesRoot: string;
    currentPluginRoot: string;
    resolveCurrentPluginRoot(): string;
    resolveActiveThemeSlug(): Promise<string | null>;
    resolveActiveThemeRoot(): Promise<string | null>;
    readCurrentPluginText(relativePath: string, options?: PluginPathReadOptions): Promise<string>;
    readCurrentPluginJson(relativePath: string, options?: PluginPathReadOptions): Promise<Record<string, any>>;
    readCurrentPluginTemplate(relativePath: string): Promise<string>;
  };

  readonly plugins: {
    namespace(namespace: string): NamespacedPluginsFacade;
    has(namespace: string, slug: string): boolean;
    get(namespace: string, slug: string): any;
    require<TPlugin = any>(key: string): TPlugin;
    optional<TPlugin = any>(key: string): TPlugin | null;
    isEnabled(slug: string): boolean;
    emit(event: string, payload: any): void;
    on(event: string, handler: (payload: any) => void | Promise<void>): void;
  };

  readonly dependencies: {
    require<TDependency = any>(key: string): TDependency;
    optional<TDependency = any>(key: string): TDependency | null;
  };

  readonly extensions: {
    installArchive(
      input: { filePath: string; type: 'plugin' | 'theme' | 'core'; enable?: boolean; activate?: boolean }
    ): Promise<any>;
  };

  // Content Management
  readonly collections: {
    register(collection: CollectionInput): void;
    extend(targetPlugin: string, targetCollection: string, extensions: Partial<Collection>): void;
  };

  readonly entities: {
    parse(collection: Collection, input: Record<string, unknown>, options?: EntityParseOptions): EntityParseResult;
    clean(collection: Collection, input: Record<string, unknown>, options?: EntityParseOptions): Record<string, unknown>;
  };

  // Plugin Settings
  readonly settings: {
    register(schema: PluginSettingsSchema): void;
    get(): Promise<Record<string, any>>;
    update(values: Record<string, any>): Promise<void>;
  };

  readonly i18n: {
    translate(
      key: string,
      params?: Record<string, any>,
      locale?: string,
      scope?: 'plugin' | 'theme' | null,
    ): string;
    translateOrFallback(
      key: string,
      fallback: string,
      params?: Record<string, any>,
      locale?: string,
      scope?: 'plugin' | 'theme' | null,
    ): string;
    t(key: string, params?: Record<string, any>): string;
    registerTranslations(pluginDirectory?: string): void;
    registerTranslations(locale: string, translations: Record<string, any>): void;
  };

  /**
   * Shortcut for i18n.t
   */
  readonly t: (key: string, params?: Record<string, any>) => string;

  readonly ui: {
    registerHeadInjection(injection: {
      tag: string;
      props: Record<string, any>;
      content?: string;
      target?: 'head' | 'bodyStart';
    }): void;
  };

  readonly runtime: {
    registerModule(name: string, config: { keys: string[], type: 'icon' | 'lib' }): void;
  };

  /**
   * Platform notifications. The framework owns BOTH recipient resolution AND delivery — a plugin
   * supplies only the message content; it never resolves users/roles or loops over recipients itself.
   * This is the sanctioned replacement for any plugin-local "find the admins and email each one" code.
   */
  readonly notifications: {
    /**
     * Email every platform admin (all users holding the `admin` role) plus any `extraRecipients`,
     * deduped/lowercased. Best-effort: never throws; returns how many recipients were resolved and
     * how many sends succeeded. Pass a ready-built `message` (subject + html/text) — the plugin owns
     * the copy/templates, the framework owns who-gets-it and the sending.
     */
    notifyAdmins(
      message: { subject: string; html?: string; text?: string },
      options?: { extraRecipients?: string[] },
    ): Promise<{ recipients: number; sent: number }>;
  };

  readonly users: {
    findAdmins(options?: { limit?: number }): Promise<Array<{ id: any; email: string; roles: string[] }>>;
    findByRole(role: string, options?: { limit?: number }): Promise<Array<{ id: any; email: string; roles: string[] }>>;
    findById(id: any): Promise<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] } | null>;
    findByEmail(email: string): Promise<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] } | null>;
    /** List users (safe profiles, newest first). */
    list(options?: { limit?: number }): Promise<Array<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] }>>;
    /** Create a user (idempotent on email). Pass an ALREADY-HASHED password (context.auth.hashPassword). */
    create(input: { email: string; password: string; roles?: string[]; firstName?: string; lastName?: string }): Promise<{ id: any } | null>;
  };

  /**
   * Canonical person/identity surface (the `people` table). Serves account holders,
   * family members, and email-only contacts. Use instead of querying SystemTable.PEOPLE
   * or any plugin-local people store directly.
   */
  readonly people: {
    match(input: { userId?: any; email?: string; phone?: string }): Promise<Record<string, any> | null>;
    getById(id: any): Promise<Record<string, any> | null>;
    getByUserId(userId: any): Promise<Record<string, any> | null>;
    getByEmail(email: string): Promise<Record<string, any> | null>;
    upsert(input: Record<string, any>): Promise<Record<string, any> | null>;
    linkAccount(personId: any, userId: any): Promise<any>;
    addRelationship(fromPersonId: any, toPersonId: any, type: string, metadata?: Record<string, any>): Promise<any>;
    listRelated(fromPersonId: any, type?: string): Promise<Array<Record<string, any>>>;
    catalogs: {
      register(kind: string, entry: { key: string; label: string; pluginSlug?: string }): Promise<void>;
      list(kind: string): Promise<Array<{ key: string; label: string }>>;
    };
    /**
     * Reusable address book on the shared `people_addresses` table. Plugins delegate their account
     * address book here instead of owning a parallel store. `ref` resolves (or, on upsert, creates)
     * the owning person from { personId } | { userId } | { email }. Plugin-specific delivery binding
     * (e.g. Econt city/office) is stored on each address's `metadata` JSON blob. A fully anonymous
     * ref (no userId/email) is rejected — guest checkout address snapshots live on the order instead.
     */
    addresses: {
      list(ref: { personId?: any; userId?: any; email?: string }): Promise<Array<Record<string, any>>>;
      upsert(ref: { personId?: any; userId?: any; email?: string }, addr: Record<string, any>): Promise<Record<string, any>>;
      delete(addressId: any): Promise<{ deleted: boolean }>;
      setDefault(ref: { personId?: any; userId?: any; email?: string }, addressId: any): Promise<Record<string, any> | null>;
    };
  };

  /**
   * Entity-records registry. Register a provider that returns the records this
   * plugin owns for a given person (invoices, declarations, agreements, orders, …).
   * The framework aggregates every plugin's records into one grouped timeline for
   * the Person 360 / partner-CRM view. namespace + slug are taken from the manifest.
   */
  readonly entityRecords: {
    registerProvider(input: {
      key: string;
      label: string;
      resolve: (ref: { personId?: any; userId?: any; email?: string | null }) => Promise<Array<{
        id: string;
        group: string;
        kind: string;
        title: string;
        subtitle?: string;
        status?: string;
        amount?: number;
        currency?: string;
        date?: string;
        href?: string;
        downloadUrl?: string;
        icon?: string;
        badges?: string[];
      }>>;
    }): any;
    unregister(key: string): void;
  };

  /**
   * Read-only access to the system meta store.
   * Use instead of querying SystemTable.META directly.
   */
  readonly meta: {
    get(key: string): Promise<string | null>;
    /** Upsert a meta value through the framework (plugins must not write SystemTable.META directly). */
    set(key: string, value: unknown): Promise<void>;
    /** Atomically advance a gap-free numeric counter (optimistic-locked) and return the new value. */
    advanceCounter(key: string, startFloor?: number, maxAttempts?: number): Promise<number>;
  };

  /**
   * Read-only access to the system media library. Use instead of querying SystemTable.MEDIA directly.
   */
  readonly media: {
    findById(id: any): Promise<Record<string, any> | null>;
  };

  /**
   * Read-only access to framework-managed record versions (SystemTable.RECORD_VERSIONS).
   * Use instead of querying the system table directly.
   */
  readonly recordVersions: {
    getById(id: any): Promise<Record<string, any> | null>;
    listByRef(refCollection: string, refId: any, limit?: number): Promise<Array<Record<string, any>>>;
  };

  /**
   * Role management helpers.
   * Use instead of querying SystemTable.ROLES directly.
   */
  readonly roles: {
    ensure(slug: string, data: { name: string; description?: string; type?: string; permissions?: any[] }): Promise<void>;
    /** Grant a role to a user (idempotent). */
    assignRole(userId: number | string, slug: string): Promise<void>;
    /** Revoke a role from a user (no-op if not assigned). */
    removeRole(userId: number | string, slug: string): Promise<void>;
    /** List the user ids that currently hold a given role. */
    listUserIdsWithRole(slug: string): Promise<number[]>;
  };

  readonly theme: {
    getActiveSlug(): Promise<string | null>;
    getActiveConfig(): Promise<Record<string, any>>;
    getCurrentPluginSettings(): Promise<Record<string, any>>;
  };
}
