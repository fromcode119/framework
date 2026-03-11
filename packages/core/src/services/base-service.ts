/**
 * Base class for all core services.
 * Provides common utilities and patterns.
 */
export abstract class BaseService {
  /**
   * Service name for logging and debugging.
   */
  abstract get serviceName(): string;

  /**
   * Log a debug message (only in development).
   */
  protected debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${this.serviceName}] ${message}`, ...args);
    }
  }

  /**
   * Log a warning message.
   */
  protected warn(message: string, ...args: any[]): void {
    console.warn(`[${this.serviceName}] ${message}`, ...args);
  }

  /**
   * Log an error message.
   */
  protected error(message: string, ...args: any[]): void {
    console.error(`[${this.serviceName}] ${message}`, ...args);
  }
}
