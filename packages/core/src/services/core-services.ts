import { LocalizationService } from './localization-service';
import { ContentService } from './content-service';
import { MenuService } from './menu-service';
import { CollectionService } from './collection-service';

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

  /**
   * Reset the singleton instance (useful for testing).
   */
  static reset(): void {
    CoreServices.instance = null;
  }
}