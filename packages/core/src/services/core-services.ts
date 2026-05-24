import { LocalizationService } from './localization-service';
import { ContentService } from './content-service';
import { MenuService } from './menu-service';
import { CollectionService } from './collection-service';
import { CollectionWriteCompatibilityService } from './collection-write-compatibility-service';
import { CollectionIdentityService } from './collection-identity-service';
import { EntityValueParserService } from './entity-value-parser-service';
import { DefaultDesignDiagnosticService } from '../plugin/default-design/default-design-diagnostic-service';
import { DefaultDesignLifecycleService } from '../plugin/default-design/default-design-lifecycle-service';
import { DefaultDesignResolutionService } from '../plugin/default-design/default-design-resolution-service';
import { DefaultDesignRuntimeBridgeService } from '../plugin/default-design/default-design-runtime-bridge-service';
import { PluginDefaultDesignRegistryService } from '../plugin/default-design/plugin-default-design-registry-service';
import { PluginDefaultPageBackfillService } from './default-page-contract/plugin-default-page-backfill-service';
import { PluginDefaultPageDiagnosticService } from './default-page-contract/plugin-default-page-diagnostic-service';
import { PluginDefaultPageMaterializationService } from './default-page-contract/plugin-default-page-materialization-service';
import { PluginDefaultPageContractRegistryService } from './default-page-contract/plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractResolutionService } from './default-page-contract/plugin-default-page-contract-resolution-service';
import { SeedPageService } from './seed-page-service';
import { ThemeDesignOverrideRegistryService } from '../theme/theme-design-override-registry-service';

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
  private _collectionWriteCompatibility: CollectionWriteCompatibilityService | null = null;
  private _collectionIdentity: CollectionIdentityService | null = null;
  private _entityValueParser: EntityValueParserService | null = null;
  private _defaultDesignDiagnostic: DefaultDesignDiagnosticService | null = null;
  private _defaultDesignLifecycle: DefaultDesignLifecycleService | null = null;
  private _defaultDesignRegistry: PluginDefaultDesignRegistryService | null = null;
  private _defaultDesignResolution: DefaultDesignResolutionService | null = null;
  private _defaultDesignRuntimeBridge: DefaultDesignRuntimeBridgeService | null = null;
  private _defaultPageContracts: PluginDefaultPageContractRegistryService | null = null;
  private _defaultPageContractResolution: PluginDefaultPageContractResolutionService | null = null;
  private _defaultPageBackfill: PluginDefaultPageBackfillService | null = null;
  private _defaultPageDiagnostic: PluginDefaultPageDiagnosticService | null = null;
  private _defaultPageMaterialization: PluginDefaultPageMaterializationService | null = null;
  private _seedPage: SeedPageService | null = null;
  private _themeDesignOverrides: ThemeDesignOverrideRegistryService | null = null;

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
    if (!this._collectionWriteCompatibility) {
      this._collectionWriteCompatibility = new CollectionWriteCompatibilityService(this.collection);
    }
    return this._collectionWriteCompatibility;
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

  get defaultDesignRegistry(): PluginDefaultDesignRegistryService {
    if (!this._defaultDesignRegistry) {
      this._defaultDesignRegistry = new PluginDefaultDesignRegistryService();
    }
    return this._defaultDesignRegistry;
  }

  get themeDesignOverrides(): ThemeDesignOverrideRegistryService {
    if (!this._themeDesignOverrides) {
      this._themeDesignOverrides = new ThemeDesignOverrideRegistryService();
    }
    return this._themeDesignOverrides;
  }

  get defaultDesignResolution(): DefaultDesignResolutionService {
    if (!this._defaultDesignResolution) {
      this._defaultDesignResolution = new DefaultDesignResolutionService(
        this.defaultDesignRegistry,
        this.themeDesignOverrides,
      );
    }
    return this._defaultDesignResolution;
  }

  get defaultDesignDiagnostic(): DefaultDesignDiagnosticService {
    if (!this._defaultDesignDiagnostic) {
      this._defaultDesignDiagnostic = new DefaultDesignDiagnosticService(
        this.defaultDesignRegistry,
        this.defaultDesignResolution,
      );
    }
    return this._defaultDesignDiagnostic;
  }

  get defaultDesignLifecycle(): DefaultDesignLifecycleService {
    if (!this._defaultDesignLifecycle) {
      this._defaultDesignLifecycle = new DefaultDesignLifecycleService(
        this.defaultDesignRegistry,
        this.themeDesignOverrides,
      );
    }
    return this._defaultDesignLifecycle;
  }

  get defaultDesignRuntimeBridge(): DefaultDesignRuntimeBridgeService {
    if (!this._defaultDesignRuntimeBridge) {
      this._defaultDesignRuntimeBridge = new DefaultDesignRuntimeBridgeService(
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
    if (!this._defaultPageContracts) {
      this._defaultPageContracts = new PluginDefaultPageContractRegistryService();
    }
    return this._defaultPageContracts;
  }

  get defaultPageContractResolution(): PluginDefaultPageContractResolutionService {
    if (!this._defaultPageContractResolution) {
      this._defaultPageContractResolution = new PluginDefaultPageContractResolutionService(this.defaultPageContracts);
    }
    return this._defaultPageContractResolution;
  }

  get defaultPageBackfill(): PluginDefaultPageBackfillService {
    if (!this._defaultPageBackfill) {
      this._defaultPageBackfill = new PluginDefaultPageBackfillService(this.seedPage);
    }
    return this._defaultPageBackfill;
  }

  get defaultPageDiagnostic(): PluginDefaultPageDiagnosticService {
    if (!this._defaultPageDiagnostic) {
      this._defaultPageDiagnostic = new PluginDefaultPageDiagnosticService(
        this.defaultPageContractResolution,
        this.defaultPageMaterialization,
        this.defaultPageBackfill,
      );
    }
    return this._defaultPageDiagnostic;
  }

  get defaultPageMaterialization(): PluginDefaultPageMaterializationService {
    if (!this._defaultPageMaterialization) {
      this._defaultPageMaterialization = new PluginDefaultPageMaterializationService(this.seedPage);
    }
    return this._defaultPageMaterialization;
  }

  get seedPage(): SeedPageService {
    if (!this._seedPage) {
      this._seedPage = new SeedPageService();
    }
    return this._seedPage;
  }

  /**
   * Reset the singleton instance (useful for testing).
   */
  static reset(): void {
    CoreServices.instance = null;
  }
}
