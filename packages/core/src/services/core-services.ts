import { LocalizationService } from './localization-service';
import { ContentService } from './content-service';
import { MenuService } from './menu-service';
import { CollectionService } from './collection-service';
import { CollectionIdentityService } from './collection-identity-service';
import { PluginDefaultPageBackfillService } from './default-page-contract/plugin-default-page-backfill-service';
import { PluginDefaultPageDiagnosticService } from './default-page-contract/plugin-default-page-diagnostic-service';
import { PluginDefaultPageMaterializationService } from './default-page-contract/plugin-default-page-materialization-service';
import { PluginDefaultPageContractRegistryService } from './default-page-contract/plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractResolutionService } from './default-page-contract/plugin-default-page-contract-resolution-service';
import { SeedPageService } from './seed-page-service';

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
  private _defaultPageContracts: PluginDefaultPageContractRegistryService | null = null;
  private _defaultPageContractResolution: PluginDefaultPageContractResolutionService | null = null;
  private _defaultPageBackfill: PluginDefaultPageBackfillService | null = null;
  private _defaultPageDiagnostic: PluginDefaultPageDiagnosticService | null = null;
  private _defaultPageMaterialization: PluginDefaultPageMaterializationService | null = null;
  private _seedPage: SeedPageService | null = null;

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

  get collectionIdentity(): CollectionIdentityService {
    if (!this._collectionIdentity) {
      this._collectionIdentity = new CollectionIdentityService();
    }
    return this._collectionIdentity;
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
