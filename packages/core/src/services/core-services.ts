import { LocalizationService } from './localization-service';
import { ContentService } from './content-service';
import { MenuService } from './menu-service';
import { CollectionService } from './collection-service';
import { CollectionWriteCompatibilityService } from './collection-write-compatibility-service';
import { CollectionIdentityService } from './collection-identity-service';
import { EntityValueParserService } from './entity-value-parser-service';
import { LayoutDiagnosticService } from '../plugin/layout/layout-diagnostic-service';
import { LayoutLifecycleService } from '../plugin/layout/layout-lifecycle-service';
import { LayoutResolutionService } from '../plugin/layout/layout-resolution-service';
import { LayoutRuntimeBridgeService } from '../plugin/layout/layout-runtime-bridge-service';
import { PluginLayoutRegistryService } from '../plugin/layout/plugin-layout-registry-service';
import { PluginDefaultPageBackfillService } from './default-page-contract/plugin-default-page-backfill-service';
import { PluginDefaultPageDiagnosticService } from './default-page-contract/plugin-default-page-diagnostic-service';
import { PluginDefaultPageMaterializationService } from './default-page-contract/plugin-default-page-materialization-service';
import { PluginDefaultPageContractRegistryService } from './default-page-contract/plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractResolutionService } from './default-page-contract/plugin-default-page-contract-resolution-service';
import { SeedPageService } from './seed-page-service';
import { ThemeLayoutOverrideRegistryService } from '../theme/theme-layout-override-registry-service';
import { ContentResolutionGateRegistryService } from './content-resolution-gate-registry-service';

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
  private _defaultDesignDiagnostic: LayoutDiagnosticService | null = null;
  private _defaultDesignLifecycle: LayoutLifecycleService | null = null;
  private _defaultDesignRegistry: PluginLayoutRegistryService | null = null;
  private _defaultDesignResolution: LayoutResolutionService | null = null;
  private _defaultDesignRuntimeBridge: LayoutRuntimeBridgeService | null = null;
  private _defaultPageContracts: PluginDefaultPageContractRegistryService | null = null;
  private _defaultPageContractResolution: PluginDefaultPageContractResolutionService | null = null;
  private _defaultPageBackfill: PluginDefaultPageBackfillService | null = null;
  private _defaultPageDiagnostic: PluginDefaultPageDiagnosticService | null = null;
  private _defaultPageMaterialization: PluginDefaultPageMaterializationService | null = null;
  private _seedPage: SeedPageService | null = null;
  private _themeDesignOverrides: ThemeLayoutOverrideRegistryService | null = null;
  private _contentResolutionGates: ContentResolutionGateRegistryService | null = null;

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
   * Registry of content-resolution gates (lazy-loaded). Plugins register
   * transformers that rewrite a resolved document before it is sent to the
   * client (e.g. members-only paywall gating). The framework stays plugin-agnostic.
   */
  get contentResolutionGates(): ContentResolutionGateRegistryService {
    if (!this._contentResolutionGates) {
      this._contentResolutionGates = new ContentResolutionGateRegistryService();
    }
    return this._contentResolutionGates;
  }

  /**
   * Reset the singleton instance (useful for testing).
   */
  static reset(): void {
    CoreServices.instance = null;
  }
}
