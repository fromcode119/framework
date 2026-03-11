import { FormatterService } from './services/formatter-service';
import { StringService } from './services/string-service';
import { MediaService } from './services/media-service';
import { ValidationService } from './services/validation-service';
import { LocalizationService } from './services/localization-service';
import { StatusService } from './services/status-service';
import { CollectionService } from './services/collection-service';
import { DateService } from './services/date-service';
import { UrlService } from './services/url-service';

/**
 * Service Locator for Admin utilities.
 * 
 * Provides centralized access to all admin services via singleton pattern.
 * Services are lazily initialized on first access.
 * 
 * @example
 * ```typescript
 * import { AdminServices } from '@fromcode119/admin';
 * 
 * const services = AdminServices.getInstance();
 * 
 * // Formatting
 * const size = services.formatter.formatSize(1024); // "1.0 KB"
 * const date = services.formatter.formatDate(new Date());
 * 
 * // Strings
 * const slug = services.string.slugify('Hello World'); // "hello-world"
 * const title = services.string.capitalize('hello'); // "Hello"
 * 
 * // Media
 * const url = services.media.resolveMediaUrl('/image.jpg');
 * const thumb = services.media.getThumbnailUrl(url, 200);
 * 
 * // Validation
 * const isValid = services.validation.isValidEmail('user@example.com');
 * const meetsCondition = services.validation.evaluateCondition(condition, data);
 * 
 * // Localization
 * const label = services.localization.resolveLabelText({ en: 'Hello', bg: 'Здравей' });
 * ```
 */
export class AdminServices {
  private static instance: AdminServices | null = null;

  private _formatter: FormatterService | null = null;
  private _string: StringService | null = null;
  private _media: MediaService | null = null;
  private _validation: ValidationService | null = null;
  private _localization: LocalizationService | null = null;
  private _status: StatusService | null = null;
  private _collection: CollectionService | null = null;
  private _date: DateService | null = null;
  private _url: UrlService | null = null;

  private constructor() {
    // Private constructor enforces singleton pattern
  }

  /**
   * Get the singleton instance of AdminServices.
   */
  static getInstance(): AdminServices {
    if (!AdminServices.instance) {
      AdminServices.instance = new AdminServices();
    }
    return AdminServices.instance;
  }

  /**
   * Reset the singleton instance (for testing).
   */
  static resetInstance(): void {
    AdminServices.instance = null;
  }

  /**
   * Formatting service (dates, numbers, sizes, currency).
   */
  get formatter(): FormatterService {
    if (!this._formatter) {
      this._formatter = new FormatterService();
    }
    return this._formatter;
  }

  /**
   * String manipulation service (capitalize, slugify, truncate).
   */
  get string(): StringService {
    if (!this._string) {
      this._string = new StringService();
    }
    return this._string;
  }

  /**
   * Media service (URL resolution, image optimization).
   */
  get media(): MediaService {
    if (!this._media) {
      this._media = new MediaService();
    }
    return this._media;
  }

  /**
   * Validation service (conditions, email, URL validation).
   */
  get validation(): ValidationService {
    if (!this._validation) {
      this._validation = new ValidationService();
    }
    return this._validation;
  }

  /**
   * Localization service (label resolution, locale normalization).
   */
  get localization(): LocalizationService {
    if (!this._localization) {
      this._localization = new LocalizationService();
    }
    return this._localization;
  }

  /**
   * Status service (labels, colours, variants for status fields).
   */
  get status(): StatusService {
    if (!this._status) this._status = new StatusService();
    return this._status;
  }

  /**
   * Collection service (slug normalisation and resolution utilities).
   */
  get collection(): CollectionService {
    if (!this._collection) this._collection = new CollectionService();
    return this._collection;
  }

  /**
   * Date service (parsing, relative formatting, expiry checks).
   */
  get date(): DateService {
    if (!this._date) this._date = new DateService();
    return this._date;
  }

  /**
   * URL service (building, joining paths, parsing query strings).
   */
  get url(): UrlService {
    if (!this._url) this._url = new UrlService();
    return this._url;
  }
}
