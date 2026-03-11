/**
 * Base class for all service classes.
 * 
 * Provides a consistent pattern for services with:
 * - Dependency injection support
 * - Lazy initialization
 * - Lifecycle hooks
 * 
 * Services are stateless and reusable across the application.
 * Use services to group related utility functions with shared dependencies.
 * 
 * @example
 * ```typescript
 * export class FormatterService extends BaseService {
 *   protected onInit(): void {
 *     // Optional: initialization logic
 *   }
 * 
 *   formatSize(bytes: number): string {
 *     if (bytes === 0) return '0 Bytes';
 *     const k = 1024;
 *     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
 *     const i = Math.floor(Math.log(bytes) / Math.log(k));
 *     return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
 *   }
 * }
 * ```
 */
export abstract class BaseService {
  private _initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service (called once during construction).
   */
  private initialize(): void {
    if (this._initialized) return;
    this.onInit();
    this._initialized = true;
  }

  /**
   * Optional lifecycle hook for initialization logic.
   * Override in subclasses to perform setup.
   */
  protected onInit(): void {
    // Default: no-op
  }

  /**
   * Check if the service is initialized.
   */
  protected get isInitialized(): boolean {
    return this._initialized;
  }
}
