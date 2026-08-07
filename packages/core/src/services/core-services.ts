import { LocalizationService } from '@core/services/localization-service';
import { ContentService } from '@core/services/content-service';
import { MenuService } from '@core/services/menu-service';
import { CollectionService } from '@core/services/collection-service';
import { CollectionIdentityService } from '@core/services/collection-identity-service';
import { EntityValueParserService } from '@core/services/entity-value-parser-service';
// TYPE-only: these are SERVER services, resolved through ServerServiceRegistry so their modules never
// enter a client bundle. `import type` is erased at compile time — a value import would put them back.
import type { CollectionWriteCompatibilityService } from '@core/services/collection-write-compatibility-service';
import type { PluginDefaultPageBackfillService } from '@core/services/default-page-contract/plugin-default-page-backfill-service';
import type { PluginDefaultPageDiagnosticService } from '@core/services/default-page-contract/plugin-default-page-diagnostic-service';
import type { PluginDefaultPageMaterializationService } from '@core/services/default-page-contract/plugin-default-page-materialization-service';
import type { PluginDefaultPageContractRegistryService } from '@core/services/default-page-contract/plugin-default-page-contract-registry-service';
import type { PluginDefaultPageContractResolutionService } from '@core/services/default-page-contract/plugin-default-page-contract-resolution-service';
import type { SeedPageService } from '@core/services/seed-page-service';
import type { ContentResolutionGateRegistryService } from '@core/services/content-resolution-gate-registry-service';
import type { RedirectResolverRegistryService } from '@core/services/redirect-resolver-registry-service';
import type { PluginEntityRecordsRegistryService } from '@core/services/entity-records/plugin-entity-records-registry-service';
import type { EntityRecordsResolutionService } from '@core/services/entity-records/entity-records-resolution-service';
import { ServerServiceRegistry } from '@core/services/server-service-registry';
import { ServerServiceKey } from '@core/services/server-service-key';
import { LayoutDiagnosticService } from '@core/plugin/layout/layout-diagnostic-service';
import { LayoutLifecycleService } from '@core/plugin/layout/layout-lifecycle-service';
import { LayoutResolutionService } from '@core/plugin/layout/layout-resolution-service';
import { LayoutRuntimeBridgeService } from '@core/plugin/layout/layout-runtime-bridge-service';
import { PluginLayoutRegistryService } from '@core/plugin/layout/plugin-layout-registry-service';
import { ThemeLayoutOverrideRegistryService } from '@core/theme/theme-layout-override-registry-service';

/**
 * Core Services Singleton.
 * 
 * Provides centralized access to all core utility services:
 * - Localization (locale handling, i18n text resolution)
 * - Content (text extraction, parsing, sanitization)
 * - Menu (path normalization, deduplication)
 * - Collection (resolution, URL generation, record lookup)
 * 
 * Lazy-loaded services are instantiated on first access.
 * 
 * @example
 * ```typescript
 * import { CoreServices } from '@fromcode119/core';
 * 
 * const services = CoreServices.getInstance();
 * 
 * // Localization
 * const text = services.localization.resolveText({ en: 'Hello', bg: 'Здравей' }, 'en');
 * 
 * // Content
 * const plainText = services.content.extractText(blockEditorData);
 * 
 * // Menu
 * const menuItems = services.menu.deduplicate(rawMenuItems);
 * 
 * // Collection
 * const collection = services.collection.resolveBySlug(collections, 'cms', 'pages');
 * ```
 */
export class CoreServices {
  private static instance: CoreServices | null = null;

  private _localization: LocalizationService | null = null;
  private _content: ContentService | null = null;
  private _menu: MenuService | null = null;
  private _collection: CollectionService | null = null;
  private _collectionIdentity: CollectionIdentityService | null = null;
  private _entityValueParser: EntityValueParserService | null = null;
  private _defaultDesignDiagnostic: LayoutDiagnosticService | null = null;
  private _defaultDesignLifecycle: LayoutLifecycleService | null = null;
  private _defaultDesignRegistry: PluginLayoutRegistryService | null = null;
  private _defaultDesignResolution: LayoutResolutionService | null = null;
  private _defaultDesignRuntimeBridge: LayoutRuntimeBridgeService | null = null;
  private _themeDesignOverrides: ThemeLayoutOverrideRegistryService | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): CoreServices {
    if (!CoreServices.instance) {
      CoreServices.instance = new CoreServices();
    }
    return CoreServices.instance;
  }

  /**
   * Localization service (lazy-loaded).
   */
  get localization(): LocalizationService {
    if (!this._localization) {
      this._localization = new LocalizationService();
    }
    return this._localization;
  }

  /**
   * Content service (lazy-loaded).
   */
  get content(): ContentService {
    if (!this._content) {
      this._content = new ContentService();
    }
    return this._content;
  }

  /**
   * Menu service (lazy-loaded).
   */
  get menu(): MenuService {
    if (!this._menu) {
      this._menu = new MenuService();
    }
    return this._menu;
  }

  /**
   * Collection service (lazy-loaded).
   */
  get collection(): CollectionService {
    if (!this._collection) {
      this._collection = new CollectionService();
    }
    return this._collection;
  }

  get collectionWriteCompatibility(): CollectionWriteCompatibilityService {
    return ServerServiceRegistry.require<CollectionWriteCompatibilityService>(ServerServiceKey.COLLECTION_WRITE_COMPATIBILITY);
  }

  get collectionIdentity(): CollectionIdentityService {
    if (!this._collectionIdentity) {
      this._collectionIdentity = new CollectionIdentityService();
    }
    return this._collectionIdentity;
  }

  get entityValueParser(): EntityValueParserService {
    if (!this._entityValueParser) {
      this._entityValueParser = new EntityValueParserService();
    }
    return this._entityValueParser;
  }

  get defaultDesignRegistry(): PluginLayoutRegistryService {
    if (!this._defaultDesignRegistry) {
      this._defaultDesignRegistry = new PluginLayoutRegistryService();
    }
    return this._defaultDesignRegistry;
  }

  get themeDesignOverrides(): ThemeLayoutOverrideRegistryService {
    if (!this._themeDesignOverrides) {
      this._themeDesignOverrides = new ThemeLayoutOverrideRegistryService();
    }
    return this._themeDesignOverrides;
  }

  get defaultDesignResolution(): LayoutResolutionService {
    if (!this._defaultDesignResolution) {
      this._defaultDesignResolution = new LayoutResolutionService(
        this.defaultDesignRegistry,
        this.themeDesignOverrides,
      );
    }
    return this._defaultDesignResolution;
  }

  get defaultDesignDiagnostic(): LayoutDiagnosticService {
    if (!this._defaultDesignDiagnostic) {
      this._defaultDesignDiagnostic = new LayoutDiagnosticService(
        this.defaultDesignRegistry,
        this.defaultDesignResolution,
      );
    }
    return this._defaultDesignDiagnostic;
  }

  get defaultDesignLifecycle(): LayoutLifecycleService {
    if (!this._defaultDesignLifecycle) {
      this._defaultDesignLifecycle = new LayoutLifecycleService(
        this.defaultDesignRegistry,
        this.themeDesignOverrides,
      );
    }
    return this._defaultDesignLifecycle;
  }

  get defaultDesignRuntimeBridge(): LayoutRuntimeBridgeService {
    if (!this._defaultDesignRuntimeBridge) {
      this._defaultDesignRuntimeBridge = new LayoutRuntimeBridgeService(
        this.defaultDesignRegistry,
        this.themeDesignOverrides,
        this.defaultDesignResolution,
        this.defaultDesignDiagnostic,
        this.defaultDesignLifecycle,
      );
    }
    return this._defaultDesignRuntimeBridge;
  }

  get defaultPageContracts(): PluginDefaultPageContractRegistryService {
    return ServerServiceRegistry.require<PluginDefaultPageContractRegistryService>(ServerServiceKey.DEFAULT_PAGE_CONTRACTS);
  }

  get defaultPageContractResolution(): PluginDefaultPageContractResolutionService {
    return ServerServiceRegistry.require<PluginDefaultPageContractResolutionService>(ServerServiceKey.DEFAULT_PAGE_CONTRACT_RESOLUTION);
  }

  get defaultPageBackfill(): PluginDefaultPageBackfillService {
    return ServerServiceRegistry.require<PluginDefaultPageBackfillService>(ServerServiceKey.DEFAULT_PAGE_BACKFILL);
  }

  get defaultPageDiagnostic(): PluginDefaultPageDiagnosticService {
    return ServerServiceRegistry.require<PluginDefaultPageDiagnosticService>(ServerServiceKey.DEFAULT_PAGE_DIAGNOSTIC);
  }

  get defaultPageMaterialization(): PluginDefaultPageMaterializationService {
    return ServerServiceRegistry.require<PluginDefaultPageMaterializationService>(ServerServiceKey.DEFAULT_PAGE_MATERIALIZATION);
  }

  get seedPage(): SeedPageService {
    return ServerServiceRegistry.require<SeedPageService>(ServerServiceKey.SEED_PAGE);
  }

  /**
   * Registry of content-resolution gates (lazy-loaded). Plugins register
   * transformers that rewrite a resolved document before it is sent to the
   * client (e.g. members-only paywall gating). The framework stays plugin-agnostic.
   */
  get contentResolutionGates(): ContentResolutionGateRegistryService {
    return ServerServiceRegistry.require<ContentResolutionGateRegistryService>(ServerServiceKey.CONTENT_RESOLUTION_GATES);
  }

  /**
   * Registry of entity-record providers (lazy-loaded). Plugins register a provider
   * that returns the records they own (invoices, declarations, orders, …) for a
   * given person; the resolution service aggregates them into one grouped timeline.
   * Backbone of the Person 360 / partner-CRM view.
   */
  get entityRecords(): PluginEntityRecordsRegistryService {
    return ServerServiceRegistry.require<PluginEntityRecordsRegistryService>(ServerServiceKey.ENTITY_RECORDS);
  }

  /**
   * Registry of redirect resolvers (lazy-loaded). Plugins register a resolver that maps a would-be-404
   * request path to a redirect target (e.g. an SEO plugin's retired-URL rules). The framework stays
   * plugin-agnostic: it only runs the resolvers and returns the first match at the routing layer.
   */
  get redirectResolvers(): RedirectResolverRegistryService {
    return ServerServiceRegistry.require<RedirectResolverRegistryService>(ServerServiceKey.REDIRECT_RESOLVERS);
  }

  get entityRecordsResolution(): EntityRecordsResolutionService {
    return ServerServiceRegistry.require<EntityRecordsResolutionService>(ServerServiceKey.ENTITY_RECORDS_RESOLUTION);
  }

  /**
   * Reset the singleton instance (useful for testing).
   *
   * The server-only services moved out to `ServerServiceRegistry`, which memoises them independently
   * of this singleton — so dropping `instance` alone left every page-contract service alive and shared
   * across tests. Their registered FACTORIES survive (that is boot-time wiring, not state); only the
   * constructed instances go, which is what "reset" has always meant to callers. Test-only: nothing in
   * production calls this.
   */
  static reset(): void {
    CoreServices.instance = null;
    ServerServiceRegistry.reset();
  }
}
